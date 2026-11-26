import { type StudentInput, validateStudent } from "@passport/core";
import { and, auditLog, type Db, eq, inArray, ne, passports, passportVersions, sql, students } from "@passport/db";
import { fail, type LedgerResult, ok, withLedgerLock } from "./lock.ts";

const IDENTITY = ["firstName", "lastName", "email"] as const;

// name and email can be fixed until the first version is issued; after that the pdf carries them, so they stay
export async function updateStudent(db: Db, studentId: string, patch: Partial<Omit<StudentInput, "studentId">>, by: string): Promise<LedgerResult<void>> {
  return withLedgerLock(db, async (tx) => {
    const [s] = await tx.select().from(students).where(eq(students.studentId, studentId));
    if (!s) return fail(`student ${studentId} doesn't exist`);
    const next: StudentInput = {
      studentId, firstName: (patch.firstName ?? s.firstName).trim(), lastName: (patch.lastName ?? s.lastName).trim(),
      email: (patch.email ?? s.email).trim().toLowerCase(), program: (patch.program ?? s.program).trim(),
      educationLevel: (patch.educationLevel ?? s.educationLevel).trim(), status: (patch.status ?? s.status).trim(),
    };
    const errors = validateStudent(next);
    if (errors.length) return fail(errors.join("; "));
    const identityChanged = IDENTITY.some((k) => next[k] !== (k === "email" ? s.email.toLowerCase() : s[k]));
    if (identityChanged) {
      const [issued] = await tx.select({ id: passportVersions.id }).from(passportVersions)
        .innerJoin(passports, eq(passports.passportId, passportVersions.passportId))
        .where(and(eq(passports.studentId, studentId), eq(passportVersions.state, "issued"))).limit(1);
      if (issued) return fail("name and email can't change after the first passport version is issued");
      const [busy] = await tx.select({ id: passportVersions.id }).from(passportVersions)
        .innerJoin(passports, eq(passports.passportId, passportVersions.passportId))
        .where(and(eq(passports.studentId, studentId), inArray(passportVersions.state, ["rendering", "anchoring"]))).limit(1);
      if (busy) return fail("a passport version for this student is being issued right now; try again in a minute");
      const [other] = await tx.select({ id: students.studentId }).from(students)
        .where(and(sql`lower(${students.email}) = ${next.email}`, ne(students.studentId, studentId)));
      if (other) return fail(`email ${next.email} already belongs to ${other.id}`);
    }
    const { studentId: _, ...fields } = next;
    await tx.update(students).set({ ...fields, updatedAt: new Date() }).where(eq(students.studentId, studentId));
    await tx.insert(auditLog).values({ actor: by, action: "student_updated", subject: studentId, details: patch });
    return ok(undefined);
  });
}
