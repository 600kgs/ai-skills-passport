"use server";

import type { RecordInput, StudentInput } from "@passport/core";
import { createRecords, deleteRecord, findStudents, updateRecord, updateStudent } from "@passport/ledger";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { enqueueIssue } from "@/lib/queue";
import type { ActionResult } from "../actions";

export type CreateResult = ActionResult & { recordId?: string };

const asRecord = (r: RecordInput): RecordInput => ({
  skillId: String(r.skillId ?? ""), dateEarned: String(r.dateEarned ?? ""),
  earnedThrough: r.earnedThrough ? String(r.earnedThrough) : null,
  verification: r.verification === "CONFIRMED" ? "CONFIRMED" : "PENDING",
});

// server actions are public endpoints, so each one checks the role itself
export async function searchStudents(q: string) {
  if (!(await currentStaff("admin"))) return [];
  return findStudents(getDb(), String(q ?? "").slice(0, 100));
}

// an existing student is read back from the database, so the form can't change who they are
export async function createRecord(studentId: string | null, student: StudentInput | null, record: RecordInput): Promise<CreateResult> {
  const d = await getDict();
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  const db = getDb();
  let who = student;
  if (studentId) {
    const [found] = (await findStudents(db, studentId, 50)).filter((s) => s.studentId === studentId);
    if (!found) return { ok: false, message: d.admin.actions.invalid };
    who = found;
  }
  if (!who) return { ok: false, message: d.admin.actions.invalid };
  const r = await createRecords(db, [{ student: who, record: asRecord(record) }], { by: me.email, source: "web" });
  if (r.rejected.length) return { ok: false, message: r.rejected[0]!.errors.join("; ") };
  await enqueueIssue(r.queue);
  const recordId = r.created[0]!.recordId;
  return { ok: true, message: fill(r.queue.length ? d.admin.records.createdIssuing : d.admin.records.created, { rec: recordId }), recordId };
}

export async function saveRecord(recordId: string, record: RecordInput): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  const r = await updateRecord(getDb(), String(recordId), asRecord(record), me.email);
  if (!r.ok) return { ok: false, message: r.error };
  await enqueueIssue(r.value.queue);
  return { ok: true, message: d.admin.records.saved };
}

export async function removeRecord(recordId: string): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  const r = await deleteRecord(getDb(), String(recordId), me.email);
  return r.ok ? { ok: true, message: fill(d.admin.records.deleted, { rec: recordId }) } : { ok: false, message: r.error };
}

export async function saveStudent(studentId: string, patch: Partial<Omit<StudentInput, "studentId">>): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  const keys = ["firstName", "lastName", "email", "program", "educationLevel", "status"] as const;
  const clean = Object.fromEntries(keys.filter((k) => typeof patch[k] === "string").map((k) => [k, patch[k]]));
  const r = await updateStudent(getDb(), String(studentId), clean, me.email);
  return r.ok ? { ok: true, message: d.admin.records.saved } : { ok: false, message: r.error };
}
