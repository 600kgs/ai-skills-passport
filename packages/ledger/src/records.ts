// skill records written by staff: the record form, excel uploads and workshop lists all come through here
import { type NewRecord, type RecordInput, recordHash, type StudentInput, validateRecord, validateStudent } from "@passport/core";
import { auditLog, type Db, eq, inArray, passports, skillAwards, skills, sql, students } from "@passport/db";
import { fail, type LedgerResult, ok, type Tx, withLedgerLock } from "./lock.ts";

export type RecordSource = "web" | "excel" | "workshop";
export type CheckResult = { index: number; errors: string[]; newStudent: boolean };

const lower = (s: string) => s.trim().toLowerCase();
const clean = (s: StudentInput): StudentInput => ({
  studentId: s.studentId.trim(), firstName: s.firstName.trim(), lastName: s.lastName.trim(), email: lower(s.email),
  program: s.program.trim(), educationLevel: s.educationLevel.trim(), status: s.status.trim(),
});
const sameIdentity = (a: { firstName: string; lastName: string; email: string }, b: StudentInput) =>
  a.firstName === b.firstName && a.lastName === b.lastName && lower(a.email) === lower(b.email);
const num = (id: string, re: RegExp) => Number(re.exec(id)?.[1] ?? 0);

// every item checked against the ledger as it is now, and against the items before it in the same batch
async function plan(tx: Tx | Db, items: NewRecord[]) {
  const catalog = new Map((await tx.select().from(skills)).map((s) => [s.skillId, s]));
  const known = new Map((await tx.select().from(students)).map((s) => [s.studentId, s]));
  const emailOwner = new Map([...known.values()].map((s) => [lower(s.email), s.studentId]));
  const fresh = new Map<string, StudentInput>(); // new students earlier in this batch

  return items.map((it, index) => {
    const student = clean(it.student);
    const record: RecordInput = { ...it.record, skillId: it.record.skillId.trim().toUpperCase(), dateEarned: it.record.dateEarned.trim(),
      earnedThrough: it.record.earnedThrough?.trim() || null };
    const errors = [...validateStudent(student), ...validateRecord(record, new Set(catalog.keys()))];
    const stored = known.get(student.studentId) ?? fresh.get(student.studentId);
    if (!errors.length && stored && !sameIdentity(stored, student)) {
      errors.push(`name or email differs from the stored student (${stored.firstName} ${stored.lastName}, ${stored.email}); edit the student instead`);
    }
    if (!errors.length && !stored) {
      const owner = emailOwner.get(student.email);
      if (owner && owner !== student.studentId) errors.push(`email ${student.email} already belongs to ${owner}`);
    }
    const newStudent = !known.has(student.studentId);
    if (!errors.length && newStudent && !fresh.has(student.studentId)) {
      fresh.set(student.studentId, student);
      emailOwner.set(student.email, student.studentId);
    }
    return { index, student, record, errors, newStudent, skill: catalog.get(record.skillId) };
  });
}

export async function checkRecords(db: Db, items: NewRecord[]): Promise<CheckResult[]> {
  return (await plan(db, items)).map(({ index, errors, newStudent }) => ({ index, errors, newStudent }));
}

// the passports among these students that now have a confirmed skill waiting to be issued
async function waiting(tx: Tx, studentIds: string[]): Promise<string[]> {
  if (!studentIds.length) return [];
  const rows = await tx.selectDistinct({ passportId: passports.passportId }).from(skillAwards)
    .innerJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(sql`${skillAwards.state} = 'pending' and ${inArray(skillAwards.studentId, studentIds)}`);
  return rows.map((r) => r.passportId).sort();
}

export async function createRecords(db: Db, items: NewRecord[], opts: { by: string; source: RecordSource; workshopId?: number }) {
  return withLedgerLock(db, async (tx) => {
    const planned = await plan(tx, items);
    const [maxes] = (await tx.execute<{ rec: number; pass: number }>(sql`
      select coalesce(max(substring(record_id from '^REC-(\\d+)$')::int), 0) as rec,
             (select coalesce(max(substring(passport_id from '^BTU-AI-(\\d+)$')::int), 0) from passports) as pass
      from skill_awards`)).rows;
    let nextRec = Number(maxes?.rec ?? 0);
    let nextPass = Number(maxes?.pass ?? 0);
    const passportOf = new Map((await tx.select().from(passports)).map((p) => [p.studentId, p.passportId]));
    const created: { index: number; recordId: string; passportId: string }[] = [];
    const rejected: { index: number; errors: string[] }[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    for (const p of planned) {
      if (p.errors.length || !p.skill) { rejected.push({ index: p.index, errors: p.errors }); continue; }
      let passportId = passportOf.get(p.student.studentId);
      if (!passportId) {
        passportId = `BTU-AI-${String(++nextPass).padStart(6, "0")}`;
        await tx.insert(students).values(p.student);
        await tx.insert(passports).values({ passportId, studentId: p.student.studentId, firstIssued: today });
        passportOf.set(p.student.studentId, passportId);
        await tx.insert(auditLog).values({ actor: opts.by, action: "passport_created", subject: passportId, details: { studentId: p.student.studentId } });
      } else {
        // program, level and status may change over a student's studies; identity was checked in plan()
        await tx.update(students).set({ program: p.student.program, educationLevel: p.student.educationLevel, status: p.student.status, updatedAt: now })
          .where(eq(students.studentId, p.student.studentId));
      }
      const recordId = `REC-${String(++nextRec).padStart(4, "0")}`;
      const confirmed = p.record.verification === "CONFIRMED";
      await tx.insert(skillAwards).values({
        recordId, studentId: p.student.studentId, skillId: p.skill.skillId, skillName: p.skill.name, category: p.skill.category,
        description: p.skill.description, earnedThrough: p.record.earnedThrough, dateEarned: p.record.dateEarned,
        verification: p.record.verification, rowHash: await recordHash(p.student.studentId, p.record, p.skill),
        state: confirmed ? "pending" : "ignored", source: opts.source, workshopId: opts.workshopId ?? null,
        createdBy: opts.by, decidedBy: confirmed ? opts.by : null, decidedAt: confirmed ? now : null,
      });
      await tx.insert(auditLog).values({ actor: opts.by, action: "record_created", subject: recordId,
        details: { studentId: p.student.studentId, skillId: p.skill.skillId, verification: p.record.verification, source: opts.source } });
      created.push({ index: p.index, recordId, passportId });
    }
    const queue = await waiting(tx, [...new Set(planned.filter((p) => !p.errors.length).map((p) => p.student.studentId))]);
    return { created, rejected, queue };
  });
}

const EDITABLE = new Set(["pending", "ignored"]);

export async function updateRecord(db: Db, recordId: string, patch: RecordInput, by: string): Promise<LedgerResult<{ queue: string[] }>> {
  return withLedgerLock(db, async (tx) => {
    const [award] = await tx.select().from(skillAwards).where(eq(skillAwards.recordId, recordId));
    if (!award) return fail(`${recordId} doesn't exist`);
    if (!EDITABLE.has(award.state)) return fail(`${recordId} is ${award.state === "applied" ? "already in an issued passport" : award.state} and can't be edited`);
    const catalog = new Map((await tx.select().from(skills)).map((s) => [s.skillId, s]));
    const record: RecordInput = { ...patch, skillId: patch.skillId.trim().toUpperCase(), earnedThrough: patch.earnedThrough?.trim() || null };
    const errors = validateRecord(record, new Set(catalog.keys()));
    if (errors.length) return fail(errors.join("; "));
    const skill = catalog.get(record.skillId)!;
    const confirmed = record.verification === "CONFIRMED";
    const newlyConfirmed = confirmed && award.verification !== "CONFIRMED";
    await tx.update(skillAwards).set({
      skillId: skill.skillId, skillName: skill.name, category: skill.category, description: skill.description,
      dateEarned: record.dateEarned, earnedThrough: record.earnedThrough, verification: record.verification,
      rowHash: await recordHash(award.studentId, record, skill), state: confirmed ? "pending" : "ignored", error: null,
      ...(newlyConfirmed ? { decidedBy: by, decidedAt: new Date() } : {}), updatedAt: new Date(),
    }).where(eq(skillAwards.recordId, recordId));
    await tx.insert(auditLog).values({ actor: by, action: "record_updated", subject: recordId, details: { ...record } });
    return ok({ queue: await waiting(tx, [award.studentId]) });
  });
}

export async function deleteRecord(db: Db, recordId: string, by: string): Promise<LedgerResult<void>> {
  return withLedgerLock(db, async (tx) => {
    const [award] = await tx.select().from(skillAwards).where(eq(skillAwards.recordId, recordId));
    if (!award) return fail(`${recordId} doesn't exist`);
    if (award.state === "applied") return fail(`${recordId} is in an issued passport; revoke the version instead`);
    if (award.state === "deleted" || award.state === "withdrawn") return fail(`${recordId} is already ${award.state}`);
    await tx.update(skillAwards).set({ state: "deleted", updatedAt: new Date() }).where(eq(skillAwards.recordId, recordId));
    await tx.insert(auditLog).values({ actor: by, action: "record_deleted", subject: recordId, details: { studentId: award.studentId } });
    return ok(undefined);
  });
}

export async function decideRecord(db: Db, recordId: string, decision: "CONFIRMED" | "REJECTED", by: string): Promise<LedgerResult<{ queue: string[] }>> {
  return withLedgerLock(db, async (tx) => {
    const [award] = await tx.select().from(skillAwards).where(eq(skillAwards.recordId, recordId));
    if (!award) return fail(`${recordId} doesn't exist`);
    if (award.verification !== "PENDING" || award.state !== "ignored") return fail(`${recordId} isn't waiting for a decision`);
    await tx.update(skillAwards).set({
      verification: decision, state: decision === "CONFIRMED" ? "pending" : "ignored", decidedBy: by, decidedAt: new Date(), updatedAt: new Date(),
    }).where(eq(skillAwards.recordId, recordId));
    await tx.insert(auditLog).values({ actor: by, action: decision === "CONFIRMED" ? "record_confirmed" : "record_rejected", subject: recordId });
    return ok({ queue: decision === "CONFIRMED" ? await waiting(tx, [award.studentId]) : [] });
  });
}
