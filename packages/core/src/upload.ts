// an admin's excel file of new skill records. columns are found by header name, in any order;
// the system assigns record ids and takes skill texts from the catalog, so those columns are ignored
import { UPLOAD_MAX_ROWS } from "./admin-jobs.ts";
import { type NewRecord, normHeader } from "./records.ts";

export const RECORD_UPLOAD_HEADERS = [
  "Student ID", "First Name", "Last Name", "BTU Email", "Program", "Education Level", "Student Status",
  "Skill ID", "Date Earned", "Earned Through", "Verification Status",
] as const;

// the old sheet called the email column "BTU Email (Test)"; files made from it still work
const ALIASES: Record<string, string> = { "btu email (test)": "btu email" };
const OPTIONAL = new Set(["earned through", "verification status"]);

export type UploadRow = { line: number; item: NewRecord; errors: string[] };
export type ParsedUpload = { rows: UploadRow[]; ignoredColumns: string[]; error?: string };

export function parseRecordUpload(grid: string[][]): ParsedUpload {
  const known = new Set(RECORD_UPLOAD_HEADERS.map(normHeader));
  const canon = (h: unknown) => ALIASES[normHeader(h)] ?? normHeader(h);
  const headerIdx = grid.findIndex((r) => r.map(canon).includes("student id") && r.map(canon).includes("skill id"));
  if (headerIdx < 0) return { rows: [], ignoredColumns: [], error: "The file needs a header row with Student ID and Skill ID. Start from the template." };

  const header = grid[headerIdx]!;
  const col = new Map<string, number>();
  header.forEach((h, i) => { if (known.has(canon(h)) && !col.has(canon(h))) col.set(canon(h), i); });
  const missing = RECORD_UPLOAD_HEADERS.filter((h) => !OPTIONAL.has(normHeader(h)) && !col.has(normHeader(h)));
  if (missing.length) return { rows: [], ignoredColumns: [], error: `The file is missing these columns: ${missing.join(", ")}. Start from the template.` };
  const ignoredColumns = header.filter((h) => normHeader(h) && !known.has(canon(h))).map((h) => String(h).trim());

  const rows: UploadRow[] = [];
  for (const [i, r] of grid.slice(headerIdx + 1).entries()) {
    const get = (h: string) => (col.has(h) ? String(r[col.get(h)!] ?? "").trim() : "");
    // a row with neither a student nor a skill is a note or a blank line, not a record
    if (!get("student id") && !get("skill id")) continue;
    const status = get("verification status").toUpperCase();
    const errors = status && status !== "PENDING" && status !== "CONFIRMED"
      ? [`verification status must be PENDING, CONFIRMED or blank, got "${get("verification status")}"`] : [];
    rows.push({
      line: headerIdx + 2 + i,
      errors,
      item: {
        student: {
          studentId: get("student id"), firstName: get("first name"), lastName: get("last name"), email: get("btu email"),
          program: get("program"), educationLevel: get("education level"), status: get("student status"),
        },
        record: { skillId: get("skill id"), dateEarned: get("date earned"), earnedThrough: get("earned through") || null, verification: status === "CONFIRMED" ? "CONFIRMED" : "PENDING" },
      },
    });
    if (rows.length > UPLOAD_MAX_ROWS) return { rows: [], ignoredColumns, error: `The file has more than ${UPLOAD_MAX_ROWS} records. Split it into smaller files.` };
  }
  return { rows, ignoredColumns };
}
