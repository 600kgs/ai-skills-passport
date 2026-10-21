// turns the raw google sheet grid into validated skill records.
// columns are found by header name, so btu can reorder or add columns safely.
import { sha256, toHex } from "./hash.ts";

export const CATEGORIES = { "AI Skill": "BDG-AI-001", "AI Applied Skill": "BDG-AI-002", "AI Advanced Skill": "BDG-AI-003" } as const;
export type Category = keyof typeof CATEGORIES;
export type Verification = "CONFIRMED" | "PENDING" | "REJECTED";

export type SkillRecord = {
  rowNumber: number;
  recordId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  program: string;
  educationLevel: string;
  passportId: string | null; // null = new student, the system assigns one
  firstIssued: string | null;
  studentStatus: string;
  skillId: string;
  skillName: string;
  category: Category;
  description: string;
  dateEarned: string;
  earnedThrough: string | null;
  verification: Verification;
  rowHash: string; // changes if anyone edits the input columns
};

export type RowResult =
  | { rowNumber: number; recordId: string; ok: true; record: SkillRecord }
  | { rowNumber: number; recordId: string; ok: false; errors: string[] };

export type ParsedSheet = { headerRow: number; columns: Record<string, number>; results: RowResult[] };

const H = {
  studentId: "student id", firstName: "first name", lastName: "last name", email: "btu email (test)",
  program: "program", educationLevel: "education level", passportId: "passport id (existing)",
  firstIssued: "first issued (existing)", studentStatus: "student status", recordId: "record id",
  skillId: "skill id", skillName: "skill name", category: "skill category", stampCode: "badge/stamp code",
  description: "skill description", dateEarned: "date earned", verification: "verification status",
  earnedThrough: "earned through", syncStatus: "passport sync status", syncedVersion: "synced passport version",
  syncedAt: "synced at (utc)", syncError: "sync error / notes",
} as const;

const REQUIRED = [H.studentId, H.firstName, H.lastName, H.email, H.program, H.educationLevel, H.studentStatus,
  H.recordId, H.skillId, H.skillName, H.category, H.description, H.dateEarned];
// fields that must agree on every row of the same student
const STUDENT_FIELDS = [H.firstName, H.lastName, H.email, H.passportId, H.firstIssued];

export const SHEET_HEADERS = H;
export const normHeader = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function parseSheet(rows: string[][]): Promise<ParsedSheet> {
  const headerIdx = rows.findIndex((r) => r.map(normHeader).includes(H.recordId) && r.map(normHeader).includes(H.studentId));
  if (headerIdx < 0) throw new Error("no header row with Student ID and Record ID");

  const columns: Record<string, number> = {};
  rows[headerIdx]!.forEach((h, i) => { columns[normHeader(h)] ??= i; });
  const missing = REQUIRED.filter((h) => columns[h] === undefined);
  if (missing.length) throw new Error(`missing columns: ${missing.join(", ")}`);

  const results: RowResult[] = [];
  const firstRowOf = new Map<string, number>();
  const studentFacts = new Map<string, Record<string, string>>();

  for (const [i, r] of rows.slice(headerIdx + 1).entries()) {
    const rowNumber = headerIdx + 2 + i;
    const get = (h: string) => (columns[h] === undefined ? "" : String(r[columns[h]!] ?? "").trim());
    // notes below the table only fill column a; a record has an id or skill data
    if (!get(H.recordId) && !get(H.skillId) && !get(H.skillName)) continue;

    const errors: string[] = [];
    const recordId = get(H.recordId);
    const empty = REQUIRED.filter((h) => !get(h));
    if (empty.length) errors.push(`missing ${empty.join(", ")}`);
    if (recordId && !/^REC-\d+$/.test(recordId)) errors.push(`bad Record ID "${recordId}"`);
    const studentId = get(H.studentId);
    if (studentId && !/^BTU-T-\d+$/.test(studentId)) errors.push(`bad Student ID "${studentId}"`);
    const passportId = get(H.passportId);
    if (passportId && !/^BTU-AI-\d{6}$/.test(passportId)) errors.push(`bad Passport ID "${passportId}"`);
    for (const h of [H.dateEarned, H.firstIssued]) {
      if (get(h) && !ISO_DATE.test(get(h))) errors.push(`${h} must be YYYY-MM-DD, got "${get(h)}"`);
    }

    const category = get(H.category);
    const isCategory = (c: string): c is Category => c in CATEGORIES;
    if (category && !isCategory(category)) errors.push(`unknown category "${category}"`);
    const stamp = get(H.stampCode);
    if (stamp && isCategory(category) && stamp !== CATEGORIES[category]) errors.push(`stamp ${stamp} doesn't match ${category}`);

    // no status column means every row is confirmed (btu's sheet notes say so)
    const verification = (columns[H.verification] === undefined ? "CONFIRMED" : get(H.verification).toUpperCase()) as Verification;
    if (!["CONFIRMED", "PENDING", "REJECTED"].includes(verification)) errors.push(`verification status "${get(H.verification)}"`);

    if (recordId) {
      const first = firstRowOf.get(recordId);
      if (first) errors.push(`duplicate Record ID ${recordId} (first on row ${first})`);
      else firstRowOf.set(recordId, rowNumber);
    }

    if (studentId) {
      const facts = Object.fromEntries(STUDENT_FIELDS.map((h) => [h, get(h)]));
      const known = studentFacts.get(studentId);
      if (!known) studentFacts.set(studentId, facts);
      else for (const h of STUDENT_FIELDS) if (known[h] !== facts[h]) errors.push(`${h} "${facts[h]}" disagrees with "${known[h]}" for ${studentId}`);
    }

    if (errors.length) {
      results.push({ rowNumber, recordId, ok: false, errors });
      continue;
    }
    // passport id stays out: the system writes it back, which mustn't count as an edit
    const inputs = [H.studentId, H.firstName, H.lastName, H.email, H.recordId, H.skillId,
      H.skillName, H.category, H.description, H.dateEarned, H.verification, H.earnedThrough].map(get);
    results.push({
      rowNumber, recordId, ok: true,
      record: {
        rowNumber, recordId, studentId,
        firstName: get(H.firstName), lastName: get(H.lastName), email: get(H.email),
        program: get(H.program), educationLevel: get(H.educationLevel),
        passportId: passportId || null, firstIssued: get(H.firstIssued) || null,
        studentStatus: get(H.studentStatus), skillId: get(H.skillId), skillName: get(H.skillName),
        category: category as Category, description: get(H.description), dateEarned: get(H.dateEarned),
        earnedThrough: get(H.earnedThrough) || null, verification,
        rowHash: toHex(await sha256(inputs.join("\u0001"))).slice(0, 16),
      },
    });
  }
  return { headerRow: headerIdx + 1, columns, results };
}
