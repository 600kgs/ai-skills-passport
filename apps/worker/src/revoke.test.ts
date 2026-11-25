// revoking a version from the website, against a real postgres with a fake chain
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, createDb, type Db, eq, passports, passportVersions, skillAwards, sql, students } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import { revokeVersion } from "./revoke.ts";

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport";
const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_test";

let db: Db;
let pool: pg.Pool;
const open = new Set<string>();
const chain = { async close(code: string) { return open.delete(code); } };
const by = "super@btu.edu.ge";

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  if (!(await admin.query("select 1 from pg_database where datname = 'passport_test'")).rowCount) await admin.query("create database passport_test");
  await admin.end();
  ({ db, pool } = createDb(TEST_URL));
  await runMigrations(db);
});
afterAll(() => pool.end());

// V1 = {A}, V2 = {A, B, C}; both issued and on chain, V2 latest
beforeEach(async () => {
  await db.execute(sql`truncate audit_log, sync_runs, skill_awards, passport_versions, passports, students restart identity cascade`);
  open.clear();
  await db.insert(students).values({ studentId: "BTU-T-0001", firstName: "Nino", lastName: "M", email: "n@btu.edu.ge", program: "CS", educationLevel: "Bachelor's", status: "Active" });
  await db.insert(passports).values({ passportId: "BTU-AI-000001", studentId: "BTU-T-0001", firstIssued: "2026-10-01" });
  const version = async (no: number, ids: string[]) => {
    const [v] = await db.insert(passportVersions).values({
      passportId: "BTU-AI-000001", versionNo: no, verificationCode: `CODE-V${no}`, state: "issued", skillCount: ids.length,
      includedRecordIds: ids, pdfSha256: "aa", txSignature: "sig", issuedAt: new Date(),
    }).returning();
    open.add(`CODE-V${no}`);
    return v!.id;
  };
  const v1 = await version(1, ["REC-A"]);
  const v2 = await version(2, ["REC-A", "REC-B", "REC-C"]);
  for (const [id, applied] of [["REC-A", v1], ["REC-B", v2], ["REC-C", v2]] as const) {
    await db.insert(skillAwards).values({
      recordId: id, studentId: "BTU-T-0001", skillId: `SKL-${id}`, skillName: id, category: "AI Skill", description: "d",
      dateEarned: "2026-10-01", verification: "CONFIRMED", rowHash: id, state: "applied", appliedInVersionId: applied,
    });
  }
  await db.update(passports).set({ latestVersionId: v2 });
});

const award = async (id: string) => (await db.select().from(skillAwards).where(eq(skillAwards.recordId, id)))[0]!;

describe("revoking a version", () => {
  it("revoke V2 withdraws the chosen record and re-issues the rest", async () => {
    const r = await revokeVersion(db, chain, { code: "CODE-V2", reason: "C was a mistake", withdraw: ["REC-C"], by });
    expect(r).toEqual({ passportId: "BTU-AI-000001", versionNo: 2, chainClosed: true, withdrawn: ["REC-C"], reissue: true });
    expect((await award("REC-C")).state).toBe("withdrawn");
    expect((await award("REC-B")).state).toBe("pending");
    expect((await award("REC-A")).state).toBe("applied");
    const [p] = await db.select().from(passports);
    const [v1] = await db.select().from(passportVersions).where(eq(passportVersions.versionNo, 1));
    expect(p!.latestVersionId).toBe(v1!.id);
    expect(open.has("CODE-V2")).toBe(false);
    const actions = (await db.select().from(auditLog)).map((a) => [a.action, a.actor]);
    expect(actions).toEqual([["version_revoked", by], ["record_withdrawn", by]]);
  });

  it("without a reissue when every new skill was the mistake", async () => {
    const r = await revokeVersion(db, chain, { code: "CODE-V2", reason: "both wrong", withdraw: ["REC-B", "REC-C"], by });
    expect(r.reissue).toBe(false);
  });

  it("withdrawing a record from an earlier version is refused", async () => {
    await expect(revokeVersion(db, chain, { code: "CODE-V2", reason: "x", withdraw: ["REC-A"], by })).rejects.toThrow(/REC-A/);
    expect((await db.select().from(passportVersions).where(eq(passportVersions.versionNo, 2)))[0]!.revokedAt).toBe(null);
  });

  it("a reason is required", async () => {
    await expect(revokeVersion(db, chain, { code: "CODE-V2", reason: "  ", withdraw: [], by })).rejects.toThrow(/reason/);
  });

  it("a second revoke of the same code only retries the chain close", async () => {
    open.delete("CODE-V2"); // the first run's chain step "failed" and someone closed it by hand meanwhile
    await revokeVersion(db, chain, { code: "CODE-V2", reason: "x", withdraw: [], by });
    open.add("CODE-V2");
    const again = await revokeVersion(db, chain, { code: "CODE-V2", reason: "x", withdraw: ["REC-C"], by });
    expect(again).toMatchObject({ chainClosed: true, withdrawn: [] });
    expect((await award("REC-C")).state).not.toBe("withdrawn");
    expect((await db.select().from(auditLog)).filter((a) => a.action === "version_revoked")).toHaveLength(1);
  });
});
