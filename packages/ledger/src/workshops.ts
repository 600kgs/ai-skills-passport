import { fromTbilisi, validateWorkshop, type WorkshopInput, type WorkshopStatus } from "@passport/core";
import { and, asc, auditLog, type Db, desc, eq, skills, sql, workshops } from "@passport/db";
import { fail, type LedgerResult, ok, withLedgerLock } from "./lock.ts";

// how a workshop is named in the activity log
export const workshopSubject = (id: number) => `W-${id}`;

export async function saveWorkshop(db: Db, id: number | null, input: WorkshopInput, by: string): Promise<LedgerResult<number>> {
  const errors = validateWorkshop(input);
  if (errors.length) return fail(errors.join("; "));
  const skillId = input.skillId?.trim() || null;
  const values = {
    kind: input.kind, title: input.title.trim(), titleEn: input.titleEn?.trim() || null,
    description: input.description.trim(), descriptionEn: input.descriptionEn?.trim() || null, trainer: input.trainer.trim(),
    startsAt: fromTbilisi(input.startsAt)!, endsAt: input.endsAt ? fromTbilisi(input.endsAt) : null,
    location: input.location.trim(), skillId, registrationUrl: input.registrationUrl.trim(),
  };
  return withLedgerLock(db, async (tx) => {
    if (skillId && !(await tx.select({ id: skills.skillId }).from(skills).where(eq(skills.skillId, skillId))).length) {
      return fail(`unknown skill "${skillId}"`);
    }
    if (id === null) {
      const [row] = await tx.insert(workshops).values({ ...values, createdBy: by }).returning({ id: workshops.id });
      await tx.insert(auditLog).values({ actor: by, action: "workshop_created", subject: workshopSubject(row!.id), details: { title: values.title } });
      return ok(row!.id);
    }
    const [row] = await tx.update(workshops).set({ ...values, updatedAt: new Date() }).where(eq(workshops.id, id)).returning({ id: workshops.id });
    if (!row) return fail(`workshop ${id} doesn't exist`);
    await tx.insert(auditLog).values({ actor: by, action: "workshop_updated", subject: workshopSubject(id), details: { title: values.title } });
    return ok(id);
  });
}

const STATUS_ACTION: Record<WorkshopStatus, string> = { published: "workshop_published", draft: "workshop_unpublished", cancelled: "workshop_cancelled" };

export async function setWorkshopStatus(db: Db, id: number, status: WorkshopStatus, by: string): Promise<LedgerResult<void>> {
  if (!Object.hasOwn(STATUS_ACTION, status)) return fail(`unknown status "${status}"`);
  return withLedgerLock(db, async (tx) => {
    const [row] = await tx.update(workshops).set({ status, updatedAt: new Date() }).where(eq(workshops.id, id)).returning({ id: workshops.id });
    if (!row) return fail(`workshop ${id} doesn't exist`);
    await tx.insert(auditLog).values({ actor: by, action: STATUS_ACTION[status], subject: workshopSubject(id) });
    return ok(undefined);
  });
}

export async function getWorkshop(db: Db, id: number) {
  const [row] = await db.select().from(workshops).where(eq(workshops.id, id));
  return row ?? null;
}

// an event counts as over once it ends, or a day after its start when it has no end
const over = (now: Date) => sql`coalesce(${workshops.endsAt}, ${workshops.startsAt} + interval '1 day') <= ${now.toISOString()}`;
const notOver = (now: Date) => sql`coalesce(${workshops.endsAt}, ${workshops.startsAt} + interval '1 day') > ${now.toISOString()}`;

export function listWorkshops(db: Db, when: "upcoming" | "past" | "drafts", now = new Date()) {
  const q = db.select({ workshop: workshops, skillName: skills.name, category: skills.category }).from(workshops)
    .leftJoin(skills, eq(skills.skillId, workshops.skillId));
  const rows = when === "drafts" ? q.where(eq(workshops.status, "draft")).orderBy(asc(workshops.startsAt))
    : when === "upcoming" ? q.where(and(sql`${workshops.status} <> 'draft'`, notOver(now))).orderBy(asc(workshops.startsAt))
    : q.where(and(sql`${workshops.status} <> 'draft'`, over(now))).orderBy(desc(workshops.startsAt));
  return rows.then((r) => r.map((x) => ({ ...x.workshop, skillName: x.skillName, category: x.category })));
}

// what visitors see: published and not over yet, soonest first
export async function upcomingPublic(db: Db, now = new Date(), limit = 50) {
  const rows = await db.select({ workshop: workshops, skillName: skills.name, category: skills.category }).from(workshops)
    .leftJoin(skills, eq(skills.skillId, workshops.skillId))
    .where(and(eq(workshops.status, "published"), notOver(now)))
    .orderBy(asc(workshops.startsAt))
    .limit(limit);
  return rows.map((x) => ({ ...x.workshop, skillName: x.skillName, category: x.category }));
}
