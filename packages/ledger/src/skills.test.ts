import { readFileSync } from "node:fs";
import { auditLog, type Db, skillAwards, skills, sql, students } from "@passport/db";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { listSkills, saveSkill } from "./skills.ts";

let db: Db;
let pool: pg.Pool;
beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());
beforeEach(() => resetLedgerDb(db));

const by = "a@btu.edu.ge";
const skill = { skillId: "SKL-001", name: "AI Literacy", category: "AI Skill" as const, description: "basics", active: true };

async function award(recordId: string, skillName: string, updatedAt: string) {
  await db.insert(students).values({ studentId: "BTU-T-0001", firstName: "Nino", lastName: "M", email: "n@btu.edu.ge", program: "CS", educationLevel: "Bachelor", status: "Active" })
    .onConflictDoNothing();
  await db.insert(skillAwards).values({
    recordId, studentId: "BTU-T-0001", skillId: "SKL-001", skillName, category: "AI Skill", description: "d",
    dateEarned: "2026-10-01", verification: "CONFIRMED", rowHash: recordId, updatedAt: new Date(updatedAt),
  });
}

describe("skill catalog", () => {
  it("migration seeds one skill per skill_id from awards, with the newest texts", async () => {
    await award("REC-0001", "Old name", "2026-10-01T00:00:00Z");
    await award("REC-0002", "New name", "2026-11-01T00:00:00Z");
    const migration = readFileSync(new URL("../../db/migrations/0007_skills.sql", import.meta.url), "utf8");
    const seed = migration.slice(migration.indexOf("-- seed"));
    await db.execute(sql.raw(seed));
    expect(await db.select({ id: skills.skillId, name: skills.name }).from(skills)).toEqual([{ id: "SKL-001", name: "New name" }]);
  });

  it("saveSkill adds a skill and logs it", async () => {
    expect(await saveSkill(db, skill, by)).toEqual({ ok: true, value: "created" });
    expect(await listSkills(db)).toMatchObject([{ skillId: "SKL-001", name: "AI Literacy" }]);
    expect((await db.select().from(auditLog))[0]).toMatchObject({ actor: by, action: "skill_added", subject: "SKL-001" });
  });

  it("saveSkill refuses an unknown category and a bad id", async () => {
    expect((await saveSkill(db, { ...skill, category: "Cooking" as never }, by)).ok).toBe(false);
    expect((await saveSkill(db, { ...skill, skillId: "skill 1" }, by)).ok).toBe(false);
    expect((await saveSkill(db, { ...skill, name: "  " }, by)).ok).toBe(false);
    expect(await listSkills(db)).toEqual([]);
  });

  it("saveSkill updates texts and never touches awards", async () => {
    await award("REC-0001", "AI Literacy", "2026-10-01T00:00:00Z");
    await saveSkill(db, skill, by);
    expect(await saveSkill(db, { ...skill, name: "AI Literacy 2" }, by)).toEqual({ ok: true, value: "updated" });
    expect((await listSkills(db))[0]?.name).toBe("AI Literacy 2");
    expect((await db.select().from(skillAwards))[0]?.skillName).toBe("AI Literacy");
  });

  it("listSkills can leave out inactive skills", async () => {
    await saveSkill(db, skill, by);
    await saveSkill(db, { ...skill, skillId: "SKL-002", active: false }, by);
    expect((await listSkills(db)).length).toBe(2);
    expect((await listSkills(db, { activeOnly: true })).map((s) => s.skillId)).toEqual(["SKL-001"]);
  });
});
