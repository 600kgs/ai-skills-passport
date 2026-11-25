import { isBtuAccount, type Role, sameEmail } from "@passport/core";
import { auditLog, type Db, eq, staff } from "@passport/db";
import { fail, type LedgerResult, ok, withLedgerLock } from "./lock.ts";

const norm = (email: string) => email.trim().toLowerCase();
const isBootstrap = (email: string, bootstrap: string[]) => bootstrap.some((b) => sameEmail(b, email));

export async function getStaffRole(db: Db, email: string): Promise<Role | null> {
  const [row] = await db.select({ role: staff.role }).from(staff).where(eq(staff.email, norm(email)));
  return row?.role ?? null;
}

export function listStaff(db: Db) {
  return db.select({ email: staff.email, role: staff.role, addedBy: staff.addedBy, updatedAt: staff.updatedAt }).from(staff).orderBy(staff.email);
}

export async function setStaffRole(db: Db, a: { email: string; role: Role; by: string; bootstrap: string[] }): Promise<LedgerResult<void>> {
  const email = norm(a.email);
  if (!isBtuAccount({ email, emailVerified: true })) return fail("only btu.edu.ge accounts can be staff");
  if (isBootstrap(email, a.bootstrap)) return fail(`${email} is a superadmin from the server config; change it there`);
  return withLedgerLock(db, async (tx) => {
    const [before] = await tx.select().from(staff).where(eq(staff.email, email));
    if (before?.role === a.role) return ok(undefined);
    await tx.insert(staff).values({ email, role: a.role, addedBy: a.by })
      .onConflictDoUpdate({ target: staff.email, set: { role: a.role, updatedAt: new Date() } });
    await tx.insert(auditLog).values({
      actor: a.by, action: before ? "staff_role_changed" : "staff_added", subject: email, details: { role: a.role, before: before?.role ?? null },
    });
    return ok(undefined);
  });
}

export async function removeStaff(db: Db, a: { email: string; by: string; bootstrap: string[] }): Promise<LedgerResult<void>> {
  const email = norm(a.email);
  if (isBootstrap(email, a.bootstrap)) return fail(`${email} is a superadmin from the server config; change it there`);
  return withLedgerLock(db, async (tx) => {
    const [gone] = await tx.delete(staff).where(eq(staff.email, email)).returning();
    if (!gone) return fail(`${email} isn't on the staff list`);
    await tx.insert(auditLog).values({ actor: a.by, action: "staff_removed", subject: email, details: { role: gone.role } });
    return ok(undefined);
  });
}
