import { CATEGORIES, type Category } from "@passport/core";
import { auditLog, type Db, eq, skills } from "@passport/db";
import { fail, type LedgerResult, ok, withLedgerLock } from "./lock.ts";

export type SkillInput = { skillId: string; name: string; category: Category; description: string; active: boolean };

export function listSkills(db: Db, opts: { activeOnly?: boolean } = {}) {
  return db.select().from(skills).where(opts.activeOnly ? eq(skills.active, true) : undefined).orderBy(skills.skillId);
}

export async function saveSkill(db: Db, input: SkillInput, by: string): Promise<LedgerResult<"created" | "updated">> {
  const s = { ...input, skillId: input.skillId.trim().toUpperCase(), name: input.name.trim(), description: input.description.trim() };
  if (!/^SKL-\d{3,}$/.test(s.skillId)) return fail(`skill id must look like SKL-001, got "${input.skillId}"`);
  if (!Object.hasOwn(CATEGORIES, s.category)) return fail(`unknown category "${s.category}"`);
  if (!s.name || !s.description) return fail("name and description are required");
  return withLedgerLock(db, async (tx) => {
    const [before] = await tx.select({ id: skills.skillId }).from(skills).where(eq(skills.skillId, s.skillId));
    const values = { name: s.name, category: s.category, description: s.description, active: s.active };
    await tx.insert(skills).values({ skillId: s.skillId, ...values })
      .onConflictDoUpdate({ target: skills.skillId, set: { ...values, updatedAt: new Date() } });
    await tx.insert(auditLog).values({ actor: by, action: before ? "skill_updated" : "skill_added", subject: s.skillId, details: values });
    return ok(before ? "updated" : "created");
  });
}
