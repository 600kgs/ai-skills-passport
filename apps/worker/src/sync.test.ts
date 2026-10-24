// sync scenarios from the brief's demo table, against a real postgres (docker compose `db`)
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { REMOVED_FROM_SHEET } from "@passport/core";
import { auditLog, createDb, eq, inArray, passports, passportVersions, skillAwards, sql, students, syncRuns, type Db } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import type { CellUpdate, SheetSource } from "./sheets.ts";
import { planImport } from "./import.ts";
import { runSync } from "./sync.ts";

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport";
const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_test";

const HEADER = ["Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level",
  "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name",
  "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Passport Sync Status",
  "Synced Passport Version", "Synced At (UTC)", "Sync Error / Notes", "Verification Status"];
const COL = Object.fromEntries(HEADER.map((h, i) => [h, i]));

type Student = { id: string; first: string; last: string; passport?: string };
const giorgi: Student = { id: "BTU-T-0001", first: "Giorgi", last: "Kapanadze", passport: "BTU-AI-000125" };
const nino: Student = { id: "BTU-T-0003", first: "Nino", last: "Maisuradze" }; // no passport yet
const record = (s: Student, rec: string, skill = "AI Literacy", verification = "CONFIRMED") => [
  s.id, s.first, s.last, `${s.id.toLowerCase()}@example.org`, "Business Administration", "Bachelor's",
  s.passport ?? "", s.passport ? "2026-09-15" : "", "Active", rec, "SKL-001", skill, "AI Skill", "BDG-AI-001",
  "Fundamentals of AI.", "2026-09-18", "SYNCED", "V1", "2026-10-17 10:00 UTC", "", verification,
];

// applies write-backs to its own grid, so the next read sees them like the real sheet
class FakeSheet implements SheetSource {
  writes: CellUpdate[][] = [];
  constructor(public grid: string[][]) {}
  async read() { return this.grid.map((r) => [...r]); }
  async write(updates: CellUpdate[]) {
    this.writes.push(updates);
    for (const u of updates) this.grid[u.row - 1]![u.col] = u.value;
  }
  async insertRows(beforeRow: number, rows: string[][]) { this.grid.splice(beforeRow - 1, 0, ...rows.map((r) => [...r])); }
  cell(row: number, header: string) { return this.grid[row - 1]![COL[header]!]; }
}
const sheetOf = (...records: string[][]) => new FakeSheet([["BTU | TEST DATA"], [], [], HEADER, ...records, [], ["TECHNICAL NOTES"]]);

let db: Db;
let pool: pg.Pool;
const queued: string[] = [];
const sync = (s: SheetSource) => runSync(db, s, { trigger: "manual", enqueue: async (p) => void queued.push(p), today: "2026-10-21" });

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = 'passport_test'");
  if (!exists.rowCount) await admin.query("create database passport_test");
  await admin.end();
  ({ db, pool } = createDb(TEST_URL));
  await runMigrations(db);
});
afterAll(() => pool.end());
beforeEach(async () => {
  queued.length = 0;
  await db.execute(sql`truncate audit_log, sync_runs, skill_awards, passport_versions, passports, students restart identity cascade`);
});

describe("sheet sync", () => {
  it("creates one passport per new student, keeps btu's id or assigns the next one", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"), record(giorgi, "REC-0015", "AI Workflow Automation"), record(nino, "REC-0003"));
    const s = await sync(sheet);
    expect(s).toMatchObject({ newRecords: 3, newPassports: 2, failedRows: 0 });
    const rows = await db.select().from(passports);
    expect(rows.map((p) => p.passportId).sort()).toEqual(["BTU-AI-000125", "BTU-AI-000126"]);
    // the assigned id is written back, and fake "SYNCED V1" is corrected to the ledger's truth
    expect(sheet.cell(7, "Passport ID (Existing)")).toBe("BTU-AI-000126");
    expect(sheet.cell(7, "First Issued (Existing)")).toBe("2026-10-21");
    expect(sheet.cell(5, "First Issued (Existing)")).toBe("2026-09-15"); // btu's date is kept
    expect(sheet.cell(5, "Passport Sync Status")).toBe("NOT SYNCED");
    expect(sheet.cell(5, "Synced Passport Version")).toBe("");
    expect(queued.sort()).toEqual(["BTU-AI-000125", "BTU-AI-000126"]);
  });

  it("repeat sync adds nothing and writes nothing", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"), record(nino, "REC-0003"));
    await sync(sheet);
    const again = await sync(sheet);
    expect(again).toMatchObject({ newRecords: 0, updatedRecords: 0, newPassports: 0, cellsWritten: 0 });
    expect(await db.$count(skillAwards)).toBe(2);
  });

  it("stops a row with a wrong student id and says why in the sheet", async () => {
    const bad = record({ ...giorgi, id: "BTU-X-0001" }, "REC-0099");
    const sheet = sheetOf(record(giorgi, "REC-0001"), bad);
    const s = await sync(sheet);
    expect(s.failedRows).toBe(1);
    expect(sheet.cell(6, "Passport Sync Status")).toBe("FAILED");
    expect(sheet.cell(6, "Sync Error / Notes")).toContain("bad Student ID");
    expect(await db.$count(skillAwards, eq(skillAwards.recordId, "REC-0099"))).toBe(0);
  });

  it("stores PENDING rows without touching the passport, then picks them up once CONFIRMED", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001", "AI Literacy", "PENDING"));
    await sync(sheet);
    expect(queued).toEqual([]);
    expect(sheet.cell(5, "Sync Error / Notes")).toContain("PENDING");

    sheet.grid[4]![COL["Verification Status"]!] = "CONFIRMED";
    const s = await sync(sheet);
    expect(s.updatedRecords).toBe(1);
    expect(queued).toEqual(["BTU-AI-000125"]);
    expect(sheet.cell(5, "Sync Error / Notes")).toBe("");
  });

  it("refuses edits to a skill that is already in an issued passport", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"));
    await sync(sheet);
    // simulate the issue job having put REC-0001 into V1
    const [v] = await db.insert(passportVersions).values({
      passportId: "BTU-AI-000125", versionNo: 1, verificationCode: "AAAA-BBBB-CC", state: "issued", skillCount: 1,
      pdfSha256: "x", txSignature: "y", issuedAt: new Date("2026-10-21T12:00:00Z"),
    }).returning();
    await db.update(skillAwards).set({ state: "applied", appliedInVersionId: v!.id });

    await sync(sheet);
    expect(sheet.cell(5, "Passport Sync Status")).toBe("SYNCED");
    expect(sheet.cell(5, "Synced Passport Version")).toBe("V1");

    sheet.grid[4]![COL["Skill Name"]!] = "AI Literacy (edited)";
    await sync(sheet);
    expect(sheet.cell(5, "Passport Sync Status")).toBe("FAILED");
    expect(sheet.cell(5, "Sync Error / Notes")).toContain("edited after it was issued");
    const [a] = await db.select().from(skillAwards);
    expect(a?.skillName).toBe("AI Literacy");
  });

  it("refuses identity changes for a student who already has a passport", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"));
    await sync(sheet);
    sheet.grid.splice(5, 0, record({ ...giorgi, first: "Gela" }, "REC-0002"));
    sheet.grid[4]![COL["First Name"]!] = "Gela";
    await sync(sheet);
    expect(sheet.cell(6, "Sync Error / Notes")).toContain("identity fields can't change");
    const [st] = await db.select().from(students);
    expect(st?.firstName).toBe("Giorgi");
  });

  it("refuses a passport id that doesn't match the student's passport", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"));
    await sync(sheet);
    sheet.grid.splice(5, 0, record({ ...giorgi, passport: "BTU-AI-000999" }, "REC-0002"));
    sheet.grid[4]![COL["Passport ID (Existing)"]!] = "BTU-AI-000999";
    await sync(sheet);
    expect(sheet.cell(5, "Sync Error / Notes")).toContain("doesn't match this student's passport");
  });
});

describe("rows deleted from the sheet", () => {
  // giorgi gets REC-0001 and REC-0002; the issue job is simulated by putting the given records into an issued V1
  const issueV1 = async (...recordIds: string[]) => {
    const [v] = await db.insert(passportVersions).values({
      passportId: "BTU-AI-000125", versionNo: 1, verificationCode: "AAAA-BBBB-CC", state: "issued", skillCount: recordIds.length,
      includedRecordIds: recordIds, pdfSha256: "x", txSignature: "y", issuedAt: new Date("2026-10-21T12:00:00Z"),
    }).returning();
    await db.update(skillAwards).set({ state: "applied", appliedInVersionId: v!.id }).where(inArray(skillAwards.recordId, recordIds));
  };
  const award = async (id: string) => (await db.select().from(skillAwards).where(eq(skillAwards.recordId, id)))[0]!;
  const removedLog = () => db.select().from(auditLog).where(eq(auditLog.action, "award_removed"));

  it("keeps an issued skill whose row was deleted, flags it once, and drops the flag when the row is back", async () => {
    const second = record(giorgi, "REC-0002", "Prompt Engineering");
    const sheet = sheetOf(record(giorgi, "REC-0001"), second);
    await sync(sheet);
    await issueV1("REC-0001", "REC-0002");

    sheet.grid.splice(5, 1);
    expect((await sync(sheet)).removedRecords).toBe(1);
    expect(await award("REC-0002")).toMatchObject({ state: "applied", error: REMOVED_FROM_SHEET });
    expect(await removedLog()).toHaveLength(1);
    expect((await sync(sheet)).removedRecords).toBe(0);
    expect(await removedLog()).toHaveLength(1);

    sheet.grid.splice(5, 0, second);
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "applied", error: null });
    expect(sheet.cell(6, "Passport Sync Status")).toBe("SYNCED");
  });

  it("holds a confirmed skill deleted before it was issued, and issues it once the row is back", async () => {
    const second = record(giorgi, "REC-0002", "Prompt Engineering");
    const sheet = sheetOf(record(giorgi, "REC-0001"), second);
    await sync(sheet);
    await issueV1("REC-0001");

    sheet.grid.splice(5, 1);
    queued.length = 0;
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "failed", error: REMOVED_FROM_SHEET });
    expect(queued).toEqual([]);

    sheet.grid.splice(5, 0, second);
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "pending", error: null });
    expect(queued).toEqual(["BTU-AI-000125"]);
  });

  it("takes a deleted PENDING row out of the waiting list, and puts it back with the row", async () => {
    const waiting = record(giorgi, "REC-0002", "Prompt Engineering", "PENDING");
    const sheet = sheetOf(record(giorgi, "REC-0001"), waiting);
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "ignored", verification: "PENDING" });

    sheet.grid.splice(5, 1);
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "failed", error: REMOVED_FROM_SHEET });

    sheet.grid.splice(5, 0, waiting);
    await sync(sheet);
    expect(await award("REC-0002")).toMatchObject({ state: "ignored", error: null });
  });

  it("doesn't take a read without any records as everything deleted", async () => {
    await sync(sheetOf(record(giorgi, "REC-0001")));
    expect((await sync(sheetOf())).removedRecords).toBe(0);
    expect(await award("REC-0001")).toMatchObject({ error: null });
  });
});

describe("sync log", () => {
  const poll =(s: SheetSource) => runSync(db, s, { trigger: "poll", enqueue: async () => {}, today: "2026-10-21" });

  it("logs polls that change something, with the rows it couldn't take, and skips quiet ones", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"), record({ ...giorgi, id: "BTU-X-0001" }, "REC-0099"));
    await poll(sheet);
    await poll(sheet);
    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.problems).toEqual([{ row: 6, recordId: "REC-0099", note: expect.stringContaining("bad Student ID") }]);
  });

  it("logs a poll whose rows to fix changed, so a deleted bad row leaves the overview", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"), record({ ...giorgi, id: "BTU-X-0001" }, "REC-0099"));
    await poll(sheet);
    await poll(sheet); // the same bad row again: no new run, even though jsonb reorders the stored keys
    sheet.grid.splice(5, 1); // someone deletes the bad row; nothing in the ledger changes
    await poll(sheet);
    await poll(sheet);
    const runs = await db.select().from(syncRuns).orderBy(syncRuns.id);
    expect(runs.map((r) => r.problems)).toEqual([[expect.objectContaining({ recordId: "REC-0099" })], []]);
  });

  it("always logs a sync an admin asked for", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"));
    await sync(sheet);
    await sync(sheet);
    expect(await db.$count(syncRuns)).toBe(2);
  });
});

describe("excel upload", () => {
  it("inserts the valid rows above the notes, and sync takes them like any sheet row", async () => {
    const sheet = sheetOf(record(giorgi, "REC-0001"));
    await sync(sheet);
    const file = [HEADER.slice(0, 16), record(nino, "REC-0003").slice(0, 16), record(giorgi, "REC-0001").slice(0, 16)];
    const plan = await planImport(await sheet.read(), file);
    expect(plan.valid.map((r) => r.recordId)).toEqual(["REC-0003"]); // REC-0001 is already in the sheet
    await sheet.insertRows(plan.insertAt, plan.valid.map((r) => r.values));

    expect(sheet.grid[plan.insertAt - 1]![COL["Record ID"]!]).toBe("REC-0003");
    expect(sheet.grid.at(-1)).toEqual(["TECHNICAL NOTES"]);
    const s = await sync(sheet);
    expect(s).toMatchObject({ newRecords: 1, newPassports: 1, failedRows: 0 });
    expect(queued).toContain("BTU-AI-000126");
  });
});
