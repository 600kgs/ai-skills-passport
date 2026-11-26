// who registered for a workshop (from its outside form's export), who passed, and the skill records made for them
import { nameFromEmail, type NewRecord, type RegistrationRow, type StudentInput, toTbilisi, validateStudent } from "@passport/core";
import { and, auditLog, type Db, eq, inArray, isNull, skillAwards, sql, students, workshopRegistrations, workshops } from "@passport/db";
import { fail, type LedgerResult, ok, withLedgerLock } from "./lock.ts";
import { createRecordsTx } from "./records.ts";
import { workshopSubject } from "./workshops.ts";

// rows with a problem in the file itself (not a btu address) aren't stored
export async function saveRegistrations(db: Db, workshopId: number, rows: RegistrationRow[], by: string): Promise<LedgerResult<{ added: number; updated: number }>> {
  return withLedgerLock(db, async (tx) => {
    const [w] = await tx.select({ id: workshops.id }).from(workshops).where(eq(workshops.id, workshopId));
    if (!w) return fail(`workshop ${workshopId} doesn't exist`);
    const existing = new Set((await tx.select({ email: workshopRegistrations.email }).from(workshopRegistrations)
      .where(eq(workshopRegistrations.workshopId, workshopId))).map((r) => r.email));
    let added = 0, updated = 0;
    for (const r of rows.filter((x) => !x.errors.length)) {
      const fields = { studentId: r.studentId, firstName: r.firstName, lastName: r.lastName, program: r.program, educationLevel: r.educationLevel };
      // passed and record_id are left alone: a fresh export never undoes what staff ticked or created
      await tx.insert(workshopRegistrations).values({ workshopId, email: r.email.toLowerCase(), ...fields, uploadedBy: by })
        .onConflictDoUpdate({ target: [workshopRegistrations.workshopId, workshopRegistrations.email], set: { ...fields, uploadedBy: by, uploadedAt: new Date() } });
      if (existing.has(r.email.toLowerCase())) updated++; else added++;
    }
    await tx.insert(auditLog).values({ actor: by, action: "registrations_uploaded", subject: workshopSubject(workshopId), details: { added, updated } });
    return ok({ added, updated });
  });
}

export async function setPassed(db: Db, workshopId: number, ids: number[], passed: boolean, by: string): Promise<LedgerResult<void>> {
  if (!ids.length) return ok(undefined);
  return withLedgerLock(db, async (tx) => {
    const rows = await tx.select().from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.workshopId, workshopId), inArray(workshopRegistrations.id, ids)));
    const done = rows.filter((r) => r.recordId);
    if (done.length) return fail(`${done.map((r) => r.email).join(", ")} already ${done.length === 1 ? "has a record" : "have records"}; change the record instead`);
    await tx.update(workshopRegistrations).set({ passed }).where(and(eq(workshopRegistrations.workshopId, workshopId), inArray(workshopRegistrations.id, ids)));
    return ok(undefined);
  });
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// every registration with how it matches the ledger, for the workshop page
export async function registrationsFor(db: Db, workshopId: number) {
  const [w] = await db.select().from(workshops).where(eq(workshops.id, workshopId));
  const rows = await db.select().from(workshopRegistrations).where(eq(workshopRegistrations.workshopId, workshopId)).orderBy(workshopRegistrations.id);
  const emails = rows.map((r) => r.email);
  const known = emails.length ? await db.select().from(students).where(inArray(sql`lower(${students.email})`, emails)) : [];
  const byEmail = new Map(known.map((s) => [s.email.toLowerCase(), s]));
  const typedIds = rows.map((r) => r.studentId).filter(Boolean);
  const idOwners = typedIds.length ? await db.select({ studentId: students.studentId, email: students.email }).from(students).where(inArray(students.studentId, typedIds)) : [];
  const ownerOf = new Map(idOwners.map((s) => [s.studentId, s.email.toLowerCase()]));
  const holders = w?.skillId && known.length
    ? new Set((await db.select({ studentId: skillAwards.studentId }).from(skillAwards)
      .where(and(eq(skillAwards.skillId, w.skillId), inArray(skillAwards.studentId, known.map((s) => s.studentId)),
        sql`${skillAwards.state} not in ('deleted', 'withdrawn') and ${skillAwards.verification} <> 'REJECTED'`))).map((r) => r.studentId))
    : new Set<string>();

  return rows.map((r) => {
    const stored = byEmail.get(r.email);
    const notes: string[] = [];
    const errors: string[] = [];
    if (stored) {
      if (!sameName(stored.firstName, r.firstName) || !sameName(stored.lastName, r.lastName)) notes.push(`stored as ${stored.firstName} ${stored.lastName}; that name is used`);
      if (r.studentId && r.studentId !== stored.studentId) notes.push(`typed id ${r.studentId}, stored ${stored.studentId}; the stored one is used`);
    } else {
      // no id typed: the system gives one when the record is made, so only the rest is checked here
      errors.push(...validateStudent({ ...asStudent(r), studentId: r.studentId || "BTU-S-000000" }));
      const owner = r.studentId ? ownerOf.get(r.studentId) : undefined;
      if (owner && owner !== r.email) errors.push(`student id ${r.studentId} belongs to ${owner}`);
      const guess = nameFromEmail(r.email);
      if (sameName(guess.firstName, r.firstName) && sameName(guess.lastName, r.lastName)) {
        notes.push("name taken from the email; check the spelling before confirming (it can be fixed until the first issue)");
      }
      if (!r.studentId) notes.push("the system gives this student an id");
    }
    const match: "existing" | "new" | "problem" = stored ? "existing" : errors.length ? "problem" : "new";
    return { ...r, match, notes, errors, hasSkill: !!stored && holders.has(stored.studentId), storedName: stored ? `${stored.firstName} ${stored.lastName}` : null };
  });
}

const asStudent = (r: { email: string; studentId: string; firstName: string; lastName: string; program: string; educationLevel: string }): StudentInput => ({
  studentId: r.studentId, firstName: r.firstName, lastName: r.lastName, email: r.email,
  program: r.program, educationLevel: r.educationLevel, status: "Active",
});

// ticked rows without a record become PENDING records for the workshop's skill. all of it runs under the
// ledger lock, so a double click can't make a record twice
export async function createWorkshopRecords(db: Db, workshopId: number, by: string): Promise<LedgerResult<{ created: string[]; rejected: { email: string; errors: string[] }[] }>> {
  return withLedgerLock(db, async (tx) => {
    const [w] = await tx.select().from(workshops).where(eq(workshops.id, workshopId));
    if (!w) return fail(`workshop ${workshopId} doesn't exist`);
    if (!w.skillId) return fail("this workshop gives no skill, so there's nothing to add to passports");
    const rows = await tx.select().from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.workshopId, workshopId), eq(workshopRegistrations.passed, true), isNull(workshopRegistrations.recordId)))
      .orderBy(workshopRegistrations.id);
    if (!rows.length) return ok({ created: [], rejected: [] });
    const emails = rows.map((r) => r.email);
    const known = new Map((await tx.select().from(students).where(inArray(sql`lower(${students.email})`, emails))).map((s) => [s.email.toLowerCase(), s]));
    // new students the form gave no id get the next BTU-S number
    const [maxS] = (await tx.execute<{ n: number }>(sql`select coalesce(max(substring(student_id from '^BTU-S-(\\d+)$')::int), 0) as n from students`)).rows;
    let nextS = Number(maxS?.n ?? 0);
    const assigned = new Map<number, string>();
    for (const r of rows) {
      if (!known.has(r.email) && !r.studentId) assigned.set(r.id, `BTU-S-${String(++nextS).padStart(6, "0")}`);
    }
    const items: NewRecord[] = rows.map((r) => {
      const s = known.get(r.email);
      return {
        // a student already in the ledger keeps who they are; only new students take what they typed
        student: s ? { studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, email: s.email, program: s.program, educationLevel: s.educationLevel, status: s.status }
          : asStudent({ ...r, studentId: assigned.get(r.id) ?? r.studentId }),
        record: { skillId: w.skillId!, dateEarned: toTbilisi(w.startsAt).slice(0, 10), earnedThrough: w.title, verification: "PENDING" },
      };
    });
    const result = await createRecordsTx(tx, items, { by, source: "workshop", workshopId });
    for (const c of result.created) {
      const reg = rows[c.index]!;
      await tx.update(workshopRegistrations).set({ recordId: c.recordId, ...(assigned.has(reg.id) ? { studentId: assigned.get(reg.id)! } : {}) })
        .where(eq(workshopRegistrations.id, reg.id));
    }
    const created = result.created.map((c) => c.recordId);
    await tx.insert(auditLog).values({ actor: by, action: "workshop_records_created", subject: workshopSubject(workshopId), details: { created, rejected: result.rejected.length } });
    return ok({ created, rejected: result.rejected.map((x) => ({ email: rows[x.index]!.email, errors: x.errors })) });
  });
}
