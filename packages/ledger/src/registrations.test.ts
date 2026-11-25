import type { RegistrationRow, StudentInput } from "@passport/core";
import { type Db, eq, passports, skillAwards, skills, students, workshopRegistrations } from "@passport/db";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { createRecords } from "./records.ts";
import { createWorkshopRecords, registrationsFor, saveRegistrations, setPassed } from "./registrations.ts";
import { saveWorkshop } from "./workshops.ts";

let db: Db;
let pool: pg.Pool;
let workshopId: number;
beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());

const by = "career@btu.edu.ge";
const giorgi: StudentInput = {
  studentId: "BTU-T-0002", firstName: "Giorgi", lastName: "Kapanadze", email: "giorgi.k@btu.edu.ge",
  program: "Computer Science", educationLevel: "Bachelor", status: "Active",
};
const row = (email: string, firstName: string, studentId: string, line = 2): RegistrationRow => ({
  line, email, studentId, firstName, lastName: "K", program: "Computer Science", educationLevel: "Bachelor", errors: [],
});
const ids = async () => (await db.select().from(workshopRegistrations).orderBy(workshopRegistrations.id)).map((r) => r.id);

beforeEach(async () => {
  await resetLedgerDb(db);
  await db.insert(skills).values({ skillId: "SKL-006", name: "AI-Assisted Research", category: "AI Skill", description: "d" });
  const r = await saveWorkshop(db, null, {
    kind: "workshop", title: "AI-Assisted Research", titleEn: null, description: "d", descriptionEn: null, trainer: "T",
    startsAt: "2026-11-25T11:00", endsAt: null, location: "Room 305", skillId: "SKL-006", registrationUrl: "https://forms.gle/x",
  }, by);
  if (!r.ok) throw new Error(r.error);
  workshopId = r.value;
  await createRecords(db, [{ student: giorgi, record: { skillId: "SKL-006", dateEarned: "2026-10-01", earnedThrough: null, verification: "PENDING" } }], { by, source: "web" });
});

describe("registrations", () => {
  it("shows a known email as existing with a note when the typed name differs, a new one as new", async () => {
    await saveRegistrations(db, workshopId, [row("giorgi.k@btu.edu.ge", "გიორგი", "BTU-T-0002"), row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001", 3)], by);
    const list = await registrationsFor(db, workshopId);
    expect(list.map((r) => [r.email, r.match])).toEqual([["giorgi.k@btu.edu.ge", "existing"], ["nino.m@btu.edu.ge", "new"]]);
    expect(list[0]!.notes.length).toBeGreaterThan(0);
    expect(list[0]!.hasSkill).toBe(true);
  });

  it("a new student whose id belongs to someone else is a problem", async () => {
    await saveRegistrations(db, workshopId, [row("other@btu.edu.ge", "X", "BTU-T-0002")], by);
    expect((await registrationsFor(db, workshopId))[0]).toMatchObject({ match: "problem" });
  });

  it("createWorkshopRecords uses the stored identity for a known email", async () => {
    await saveRegistrations(db, workshopId, [row("giorgi.k@btu.edu.ge", "გიორგი", "WRONG-ID")], by);
    await setPassed(db, workshopId, await ids(), true, by);
    const r = await createWorkshopRecords(db, workshopId, by);
    expect(r.ok && r.value.created.length).toBe(1);
    expect(r.ok && r.value.rejected).toEqual([]);
    const awards = await db.select().from(skillAwards).where(eq(skillAwards.source, "workshop"));
    expect(awards).toMatchObject([{ studentId: "BTU-T-0002", skillId: "SKL-006", verification: "PENDING", workshopId, dateEarned: "2026-11-25", earnedThrough: "AI-Assisted Research" }]);
    expect((await db.select().from(students).where(eq(students.studentId, "BTU-T-0002")))[0]!.firstName).toBe("Giorgi");
  });

  it("createWorkshopRecords twice creates no duplicates", async () => {
    await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001")], by);
    await setPassed(db, workshopId, await ids(), true, by);
    await Promise.all([createWorkshopRecords(db, workshopId, by), createWorkshopRecords(db, workshopId, by)]);
    await createWorkshopRecords(db, workshopId, by);
    expect(await db.select().from(skillAwards).where(eq(skillAwards.source, "workshop"))).toHaveLength(1);
  });

  it("only ticked rows become records", async () => {
    await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001"), row("luka@btu.edu.ge", "Luka", "BTU-T-0003", 3)], by);
    await setPassed(db, workshopId, [(await ids())[0]!], true, by);
    const r = await createWorkshopRecords(db, workshopId, by);
    expect(r.ok && r.value.created.length).toBe(1);
  });

  it("re-upload keeps ticks and record ids", async () => {
    await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001")], by);
    await setPassed(db, workshopId, await ids(), true, by);
    await createWorkshopRecords(db, workshopId, by);
    const r = await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nina", "BTU-T-0001"), row("luka@btu.edu.ge", "Luka", "BTU-T-0003", 3)], by);
    expect(r).toEqual({ ok: true, value: { added: 1, updated: 1 } });
    const [nino] = await db.select().from(workshopRegistrations).where(eq(workshopRegistrations.email, "nino.m@btu.edu.ge"));
    expect(nino).toMatchObject({ passed: true, firstName: "Nina" });
    expect(nino!.recordId).toMatch(/^REC-/);
  });

  it("new student gets status Active and a passport", async () => {
    await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001")], by);
    await setPassed(db, workshopId, await ids(), true, by);
    await createWorkshopRecords(db, workshopId, by);
    const [s] = await db.select().from(students).where(eq(students.studentId, "BTU-T-0001"));
    expect(s).toMatchObject({ status: "Active", email: "nino.m@btu.edu.ge" });
    expect(await db.select().from(passports).where(eq(passports.studentId, "BTU-T-0001"))).toHaveLength(1);
  });

  it("setPassed refuses a row that already has a record", async () => {
    await saveRegistrations(db, workshopId, [row("nino.m@btu.edu.ge", "Nino", "BTU-T-0001")], by);
    await setPassed(db, workshopId, await ids(), true, by);
    await createWorkshopRecords(db, workshopId, by);
    expect((await setPassed(db, workshopId, await ids(), false, by)).ok).toBe(false);
  });

  it("a workshop without a skill can't make records", async () => {
    const w = await saveWorkshop(db, null, {
      kind: "hackathon", title: "H", titleEn: null, description: "d", descriptionEn: null, trainer: "T",
      startsAt: "2026-11-25T11:00", endsAt: null, location: "Online", skillId: null, registrationUrl: "https://forms.gle/x",
    }, by);
    expect((await createWorkshopRecords(db, w.ok ? w.value : 0, by)).ok).toBe(false);
  });
});
