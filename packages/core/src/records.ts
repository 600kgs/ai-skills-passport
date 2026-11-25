// the rules every new or edited skill record must pass, whatever it came from: the record form,
// an excel upload or a workshop's list of who passed
import { isBtuAccount } from "./access.ts";
import { sha256, toHex } from "./hash.ts";

export type StudentInput = {
  studentId: string; firstName: string; lastName: string; email: string;
  program: string; educationLevel: string; status: string;
};
export type RecordInput = { skillId: string; dateEarned: string; earnedThrough: string | null; verification: "PENDING" | "CONFIRMED" };
export type NewRecord = { student: StudentInput; record: RecordInput };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// the shape alone lets 2026-02-31 through, and postgres would then reject it and roll back the whole write
export const realDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return ISO_DATE.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};
// real btu student ids aren't known yet (all data so far is BTU-T-nnnn test data), so only the shape is checked
const STUDENT_ID = /^[A-Za-z0-9-]{1,32}$/;

const REQUIRED_STUDENT: (keyof StudentInput)[] = ["firstName", "lastName", "program", "educationLevel", "status"];

export function validateStudent(s: StudentInput): string[] {
  const errors: string[] = [];
  if (!STUDENT_ID.test(s.studentId.trim())) errors.push(`student id "${s.studentId}" must be 1-32 letters, digits or dashes`);
  if (!isBtuAccount({ email: s.email.trim(), emailVerified: true })) errors.push(`email "${s.email}" must be a btu.edu.ge address`);
  for (const k of REQUIRED_STUDENT) if (!s[k].trim()) errors.push(`${k} is required`);
  return errors;
}

export function validateRecord(r: RecordInput, skillIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (!skillIds.has(r.skillId.trim())) errors.push(`unknown skill "${r.skillId}"`);
  if (!realDate(r.dateEarned.trim())) errors.push(`date earned "${r.dateEarned}" must be a real date as YYYY-MM-DD`);
  if (r.verification !== "PENDING" && r.verification !== "CONFIRMED") errors.push(`verification must be PENDING or CONFIRMED, got "${r.verification}"`);
  if ((r.earnedThrough ?? "").length > 200) errors.push("earned through is longer than 200 characters");
  return errors;
}

// what the issue job compares to know a frozen skill wasn't edited. verification stays out: confirming isn't an edit
export async function recordHash(studentId: string, r: RecordInput, skill: { name: string; category: string; description: string }): Promise<string> {
  const fields = [studentId, r.skillId, skill.name, skill.category, skill.description, r.dateEarned, r.earnedThrough ?? ""];
  return toHex(await sha256(JSON.stringify(fields)));
}
