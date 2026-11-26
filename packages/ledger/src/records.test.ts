import type { NewRecord, StudentInput } from "@passport/core";
import { auditLog, type Db, eq, passports, passportVersions, skillAwards, skills, students } from "@passport/db";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { passportsWaitingToIssue } from "./queries.ts";
import { checkRecords, createRecords, decideRecord, deleteRecord, updateRecord } from "./records.ts";
import { updateStudent } from "./students.ts";

let db: Db;
let pool: pg.Pool;
beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());
beforeEach(async () => {
  await resetLedgerDb(db);
  await db.insert(skills).values([
    { skillId: "SKL-001", name: "AI Literacy", category: "AI Skill", description: "basics" },
    { skillId: "SKL-002", name: "Prompting", category: "AI Applied Skill", description: "prompts" },
  ]);
});

const by = "admin@btu.edu.ge";
const nino: StudentInput = {
  studentId: "BTU-T-0001", firstName: "Nino", lastName: "Maisuradze", email: "nino.m@btu.edu.ge",
  program: "Computer Science", educationLevel: "Bachelor", status: "Active",
};
const giorgi: StudentInput = { ...nino, studentId: "BTU-T-0002", firstName: "Giorgi", lastName: "K", email: "giorgi.k@btu.edu.ge" };
const item = (student: StudentInput, verification: "PENDING" | "CONFIRMED" = "PENDING", skillId = "SKL-001"): NewRecord =>
  ({ student, record: { skillId, dateEarned: "2026-11-25", earnedThrough: null, verification } });
const web = { by, source: "web" as const };

async function issuedVersionFor(passportId: string, recordId: string) {
  const [v] = await db.insert(passportVersions).values({
    passportId, versionNo: 1, verificationCode: `CODE-${recordId}`, state: "issued", skillCount: 1,
    includedRecordIds: [recordId], pdfSha256: "aa", txSignature: "sig", issuedAt: new Date(),
  }).returning();
  await db.update(skillAwards).set({ state: "applied", appliedInVersionId: v!.id }).where(eq(skillAwards.recordId, recordId));
  await db.update(passports).set({ latestVersionId: v!.id }).where(eq(passports.passportId, passportId));
}

describe("creating records", () => {
  it("assigns REC ids above the highest and a new BTU-AI id", async () => {
    await db.insert(students).values({ ...giorgi, status: "Active" });
    await db.insert(passports).values({ passportId: "BTU-AI-000150", studentId: giorgi.studentId, firstIssued: "2026-10-01" });
    await db.insert(skillAwards).values({
      recordId: "REC-0122", studentId: giorgi.studentId, skillId: "SKL-001", skillName: "x", category: "AI Skill",
      description: "x", dateEarned: "2026-10-01", verification: "CONFIRMED", rowHash: "h", state: "applied",
    });
    const r = await createRecords(db, [item(nino)], web);
    expect(r.created).toEqual([{ index: 0, recordId: "REC-0123", passportId: "BTU-AI-000151" }]);
    const [award] = await db.select().from(skillAwards).where(eq(skillAwards.recordId, "REC-0123"));
    expect(award).toMatchObject({ skillName: "AI Literacy", category: "AI Skill", source: "web", createdBy: by, state: "ignored", verification: "PENDING" });
    expect((await db.select().from(auditLog)).map((a) => a.action)).toEqual(["passport_created", "record_created"]);
  });

  it("starts at REC-0001 and BTU-AI-000001 on an empty ledger", async () => {
    const r = await createRecords(db, [item(nino)], web);
    expect(r.created[0]).toMatchObject({ recordId: "REC-0001", passportId: "BTU-AI-000001" });
  });

  it("CONFIRMED returns the passport in queue; PENDING does not", async () => {
    const pending = await createRecords(db, [item(nino)], web);
    expect(pending.queue).toEqual([]);
    const confirmed = await createRecords(db, [item(nino, "CONFIRMED", "SKL-002")], web);
    expect(confirmed.queue).toEqual(["BTU-AI-000001"]);
    const [a] = await db.select().from(skillAwards).where(eq(skillAwards.recordId, "REC-0002"));
    expect(a).toMatchObject({ state: "pending", decidedBy: by });
  });

  it("rejects a known student with a different name and keeps the valid rows", async () => {
    await createRecords(db, [item(nino)], web);
    const r = await createRecords(db, [item({ ...nino, firstName: "Nina" }), item(giorgi)], web);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]!.index).toBe(0);
    expect(r.rejected[0]!.errors[0]).toContain("differs");
    expect(r.created.map((c) => c.index)).toEqual([1]);
  });

  it("rejects an email owned by another student", async () => {
    await createRecords(db, [item(nino)], web);
    const r = await createRecords(db, [item({ ...giorgi, email: "NINO.M@btu.edu.ge" })], web);
    expect(r.rejected[0]!.errors[0]).toContain("already belongs to BTU-T-0001");
    expect(await db.select().from(students)).toHaveLength(1);
  });

  it("rejects two different new students with the same email in one batch", async () => {
    const r = await createRecords(db, [item(nino), item({ ...giorgi, email: nino.email })], web);
    expect(r.created).toHaveLength(1);
    expect(r.rejected[0]!.index).toBe(1);
  });

  it("checkRecords reports the same problems without writing", async () => {
    await createRecords(db, [item(nino)], web);
    const c = await checkRecords(db, [item({ ...nino, firstName: "Nina" }), item(giorgi), item(giorgi, "PENDING", "SKL-404")]);
    expect(c.map((x) => [x.errors.length > 0, x.newStudent])).toEqual([[true, false], [false, true], [true, true]]);
    expect(await db.select().from(students)).toHaveLength(1);
  });
});

describe("changing records", () => {
  it("updateRecord and deleteRecord refuse an applied record", async () => {
    const { created } = await createRecords(db, [item(nino, "CONFIRMED")], web);
    await issuedVersionFor(created[0]!.passportId, created[0]!.recordId);
    const upd = await updateRecord(db, created[0]!.recordId, { ...item(nino).record, dateEarned: "2026-11-01" }, by);
    expect(upd.ok).toBe(false);
    expect((await deleteRecord(db, created[0]!.recordId, by)).ok).toBe(false);
  });

  it("updateRecord changes an unissued record and its hash", async () => {
    const { created } = await createRecords(db, [item(nino)], web);
    const [before] = await db.select().from(skillAwards);
    const r = await updateRecord(db, created[0]!.recordId, { skillId: "SKL-002", dateEarned: "2026-11-01", earnedThrough: "Workshop", verification: "PENDING" }, by);
    expect(r.ok).toBe(true);
    const [after] = await db.select().from(skillAwards);
    expect(after).toMatchObject({ skillName: "Prompting", dateEarned: "2026-11-01", earnedThrough: "Workshop" });
    expect(after!.rowHash).not.toBe(before!.rowHash);
  });

  it("deleteRecord soft-deletes and the record stops waiting", async () => {
    const { created } = await createRecords(db, [item(nino, "CONFIRMED")], web);
    expect((await deleteRecord(db, created[0]!.recordId, by)).ok).toBe(true);
    expect((await db.select().from(skillAwards))[0]!.state).toBe("deleted");
    expect(await passportsWaitingToIssue(db)).toEqual([]);
  });

  it("decideRecord confirms a pending record and queues its passport", async () => {
    const { created } = await createRecords(db, [item(nino)], web);
    const r = await decideRecord(db, created[0]!.recordId, "CONFIRMED", by);
    expect(r).toEqual({ ok: true, value: { queue: ["BTU-AI-000001"] } });
    expect((await db.select().from(skillAwards))[0]).toMatchObject({ state: "pending", verification: "CONFIRMED", decidedBy: by });
    expect((await decideRecord(db, created[0]!.recordId, "REJECTED", by)).ok).toBe(false);
  });

  it("decideRecord rejects and keeps it out", async () => {
    const { created } = await createRecords(db, [item(nino)], web);
    expect((await decideRecord(db, created[0]!.recordId, "REJECTED", by)).ok).toBe(true);
    expect((await db.select().from(skillAwards))[0]).toMatchObject({ state: "ignored", verification: "REJECTED" });
  });

  it("decideRecord waits for the passport-sync lock", async () => {
    const { created } = await createRecords(db, [item(nino)], web);
    const holder = new pg.Client({ connectionString: process.env.TEST_LEDGER_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_ledger_test" });
    await holder.connect();
    await holder.query("begin");
    await holder.query("select pg_advisory_xact_lock(hashtext('passport-sync'))");
    let done = false;
    const decided = decideRecord(db, created[0]!.recordId, "CONFIRMED", by).then((r) => { done = true; return r; });
    await new Promise((r) => setTimeout(r, 300));
    expect(done).toBe(false);
    await holder.query("commit");
    await holder.end();
    expect((await decided).ok).toBe(true);
  });
});

describe("while a version is being issued", () => {
  async function inFlight(passportId: string, recordId: string, state: "rendering" | "anchoring") {
    await db.insert(passportVersions).values({ passportId, versionNo: 1, verificationCode: `FLY-${recordId}`, state, skillCount: 1, includedRecordIds: [recordId] });
  }

  it("updateRecord and deleteRecord refuse a record in a version being written to the chain", async () => {
    const { created } = await createRecords(db, [item(nino, "CONFIRMED")], web);
    await inFlight(created[0]!.passportId, created[0]!.recordId, "anchoring");
    expect(await updateRecord(db, created[0]!.recordId, { ...item(nino).record, dateEarned: "2026-11-01" }, by)).toMatchObject({ ok: false });
    expect(await deleteRecord(db, created[0]!.recordId, by)).toMatchObject({ ok: false });
    expect((await db.select().from(skillAwards))[0]).toMatchObject({ state: "pending", dateEarned: "2026-11-25" });
  });

  it("updateStudent refuses a name change while the first version is being made", async () => {
    const { created } = await createRecords(db, [item(nino, "CONFIRMED")], web);
    await inFlight(created[0]!.passportId, created[0]!.recordId, "rendering");
    expect((await updateStudent(db, nino.studentId, { firstName: "Nina" }, by)).ok).toBe(false);
  });
});

describe("duplicates", () => {
  it("the same skill on the same date for one student is refused, but not after it was deleted", async () => {
    const first = await createRecords(db, [item(nino, "CONFIRMED")], web);
    const again = await createRecords(db, [item(nino, "CONFIRMED")], web);
    expect(again.created).toEqual([]);
    expect(again.rejected[0]!.errors[0]).toContain(first.created[0]!.recordId);
    expect((await checkRecords(db, [item(nino)]))[0]!.errors.length).toBe(1);
    await deleteRecord(db, first.created[0]!.recordId, by);
    expect((await createRecords(db, [item(nino)], web)).created).toHaveLength(1);
  });

  it("the same row twice in one file is refused the second time", async () => {
    const r = await createRecords(db, [item(nino), item(nino)], web);
    expect(r.created).toHaveLength(1);
    expect(r.rejected.map((x) => x.index)).toEqual([1]);
  });
});

describe("students", () => {
  it("updateStudent refuses a name change after the first issued version, allows it before", async () => {
    const { created } = await createRecords(db, [item(nino, "CONFIRMED")], web);
    expect((await updateStudent(db, nino.studentId, { firstName: "Nina" }, by)).ok).toBe(true);
    await issuedVersionFor(created[0]!.passportId, created[0]!.recordId);
    expect((await updateStudent(db, nino.studentId, { firstName: "Nino" }, by)).ok).toBe(false);
    expect((await updateStudent(db, nino.studentId, { program: "Data Science" }, by)).ok).toBe(true);
    expect((await db.select().from(students))[0]).toMatchObject({ firstName: "Nina", program: "Data Science" });
  });

  it("updateStudent refuses an email another student has", async () => {
    await createRecords(db, [item(nino), item(giorgi)], web);
    expect((await updateStudent(db, giorgi.studentId, { email: nino.email }, by)).ok).toBe(false);
  });
});

describe("issue queue", () => {
  it("passportsWaitingToIssue lists every passport with a pending award", async () => {
    await createRecords(db, [item(nino, "CONFIRMED"), item(giorgi)], web);
    expect(await passportsWaitingToIssue(db)).toEqual(["BTU-AI-000001"]);
  });
});
