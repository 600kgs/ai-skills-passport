import { recordFilters, type StudentInput } from "@passport/core";
import { type Db, skills } from "@passport/db";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { findStudents, listRecords } from "./queries.ts";
import { createRecords } from "./records.ts";

let db: Db;
let pool: pg.Pool;
beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());

const nino: StudentInput = {
  studentId: "BTU-T-0001", firstName: "Nino", lastName: "Maisuradze", email: "nino.m@btu.edu.ge",
  program: "Computer Science", educationLevel: "Bachelor", status: "Active",
};
const giorgi: StudentInput = { ...nino, studentId: "BTU-T-0002", firstName: "Giorgi", lastName: "Kapanadze", email: "giorgi.k@btu.edu.ge" };
const rec = (skillId: string, verification: "PENDING" | "CONFIRMED" = "PENDING") => ({ skillId, dateEarned: "2026-11-25", earnedThrough: null, verification });

beforeEach(async () => {
  await resetLedgerDb(db);
  await db.insert(skills).values([
    { skillId: "SKL-001", name: "AI Literacy", category: "AI Skill", description: "d" },
    { skillId: "SKL-002", name: "Prompting", category: "AI Applied Skill", description: "d" },
  ]);
  await createRecords(db, [{ student: nino, record: rec("SKL-001") }, { student: nino, record: rec("SKL-002", "CONFIRMED") }], { by: "a", source: "web" });
  await createRecords(db, [{ student: giorgi, record: rec("SKL-001") }], { by: "a", source: "excel" });
});

describe("record list", () => {
  it("searches by name, id or email and filters by verification and source", async () => {
    expect((await listRecords(db, recordFilters({ q: "maisur" }))).total).toBe(2);
    expect((await listRecords(db, recordFilters({ q: "REC-0003" }))).rows.map((r) => r.recordId)).toEqual(["REC-0003"]);
    expect((await listRecords(db, recordFilters({ verification: "PENDING" }))).total).toBe(2);
    expect((await listRecords(db, recordFilters({ source: "excel" }))).rows[0]).toMatchObject({ firstName: "Giorgi", skillName: "AI Literacy" });
  });

  it("lists newest records first", async () => {
    expect((await listRecords(db, recordFilters({}))).rows.map((r) => r.recordId)).toEqual(["REC-0003", "REC-0002", "REC-0001"]);
  });
});

describe("student search", () => {
  it("finds a student by part of the name, email or id, with their passport", async () => {
    expect((await findStudents(db, "giorgi.k"))).toMatchObject([{ studentId: "BTU-T-0002", passportId: "BTU-AI-000002" }]);
    expect((await findStudents(db, "BTU-T-000")).length).toBe(2);
    expect(await findStudents(db, " ")).toEqual([]);
  });
});
