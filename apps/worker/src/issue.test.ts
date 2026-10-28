// issue job against a real postgres, with a fake chain, renderer and store
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { equalBytes, sha256 } from "@passport/core";
import { auditLog, createDb, eq, passports, passportVersions, skillAwards, sql, students, type Db } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import type { Chain, Found } from "./chain.ts";
import { issuePassport, type IssueDeps } from "./issue.ts";
import type { Passport } from "./pdf/template.ts";
import type { PdfStore } from "./storage.ts";

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport";
const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_test";

let db: Db;
let pool: pg.Pool;

// every render differs (like chromium's real timestamps), so a re-render would change the hash
let renders: Passport[] = [];
// runs once while the next pdf renders, like a sync landing mid-issue
let duringRender: (() => Promise<unknown>) | null = null;
const render = async (p: Passport) => {
  renders.push(p);
  const hook = duringRender;
  duringRender = null;
  await hook?.();
  return new TextEncoder().encode(`${JSON.stringify(p)}#${renders.length}`);
};

class FakeChain implements Chain {
  records = new Map<string, Found>();
  attestCalls = 0;
  failNext: "before-write" | "after-write" | null = null;
  duringWrite: (() => Promise<unknown>) | null = null;
  async attest({ code, pdfSha256, version }: { code: string; pdfSha256: Uint8Array; version: number }) {
    this.attestCalls++;
    await this.duringWrite?.();
    if (this.failNext === "before-write") { this.failNext = null; throw new Error("rpc timeout"); }
    const found = { address: `att-${code}`, signature: `sig-${code}`, signer: "issuer", pdfSha256, version };
    this.records.set(code, found);
    if (this.failNext === "after-write") { this.failNext = null; throw new Error("connection reset after send"); }
    return found;
  }
  async find(code: string) { return this.records.get(code) ?? null; }
}

const memoryStore = (): PdfStore & { files: Map<string, Uint8Array> } => {
  const files = new Map<string, Uint8Array>();
  return { files, async put(sha, pdf) { files.set(sha, pdf); return `mem/${sha}.pdf`; }, async get(sha) { return files.get(sha) ?? null; } };
};

let chain: FakeChain;
let store: ReturnType<typeof memoryStore>;
let deps: IssueDeps;

async function seed(...records: [string, string, string][]) {
  await db.insert(students).values({ studentId: "BTU-T-0001", firstName: "Giorgi", lastName: "Kapanadze", email: "btu-t-0001@example.org", program: "BA", educationLevel: "Bachelor's", status: "Active" }).onConflictDoNothing();
  await db.insert(passports).values({ passportId: "BTU-AI-000125", studentId: "BTU-T-0001", firstIssued: "2026-09-15" }).onConflictDoNothing();
  for (const [recordId, skillName, dateEarned] of records) {
    await db.insert(skillAwards).values({ recordId, studentId: "BTU-T-0001", skillId: "SKL-001", skillName, category: "AI Skill", description: "d", dateEarned, verification: "CONFIRMED", rowHash: recordId, state: "pending" });
  }
}
const issue = () => issuePassport(db, deps, "BTU-AI-000125");
const versions = () => db.select().from(passportVersions).orderBy(passportVersions.versionNo);
const latestId = async () => (await db.select().from(passports))[0]?.latestVersionId ?? null;

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  if (!(await admin.query("select 1 from pg_database where datname = 'passport_test'")).rowCount) await admin.query("create database passport_test");
  await admin.end();
  ({ db, pool } = createDb(TEST_URL));
  await runMigrations(db);
});
afterAll(() => pool.end());
beforeEach(async () => {
  await db.execute(sql`truncate audit_log, sync_runs, skill_awards, passport_versions, passports, students restart identity cascade`);
  renders = [];
  duringRender = null;
  chain = new FakeChain();
  store = memoryStore();
  deps = { render, chain, store, publicBaseUrl: "https://passport.example" };
});

describe("issue job", () => {
  it("issues V1: pdf stored, its hash on chain, skills applied, latest set", async () => {
    await seed(["REC-0015", "AI Workflow Automation", "2026-10-01"], ["REC-0001", "AI Literacy", "2026-09-18"]);
    const r = await issue();
    expect(r.status).toBe("issued");

    const [v] = await versions();
    expect(v).toMatchObject({ versionNo: 1, state: "issued", skillCount: 2 });
    expect(await latestId()).toBe(v!.id);
    const stored = store.files.get(v!.pdfSha256!)!;
    expect(equalBytes(chain.records.get(v!.verificationCode)!.pdfSha256, await sha256(stored))).toBe(true);
    expect(renders[0]!.skills.map((s) => s.name)).toEqual(["AI Literacy", "AI Workflow Automation"]); // by date earned
    expect(renders[0]!.verifyUrl).toBe(`https://passport.example/v/${v!.verificationCode}`);
    expect((await db.select().from(skillAwards)).every((a) => a.state === "applied" && a.appliedInVersionId === v!.id)).toBe(true);
  });

  it("does nothing when no skill is pending", async () => {
    await seed();
    expect(await issue()).toEqual({ status: "nothing-pending" });
    expect(await versions()).toHaveLength(0);
  });

  it("keeps the previous latest on a chain failure, then resumes without re-rendering", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    chain.failNext = "before-write";
    await expect(issue()).rejects.toThrow("rpc timeout");
    let [v] = await versions();
    expect(v).toMatchObject({ state: "failed", error: "rpc timeout" });
    expect(await latestId()).toBeNull();
    expect((await db.select().from(skillAwards))[0]?.state).toBe("pending");

    const r = await issue();
    [v] = await versions();
    expect(r.status === "issued" && r.code).toBe(v!.verificationCode); // same version, same code
    expect(v!.state).toBe("issued");
    expect(renders).toHaveLength(1); // the stored pdf was reused, the hash didn't change
  });

  it("finishes after a crash that happened right after the chain write", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    chain.failNext = "after-write";
    await expect(issue()).rejects.toThrow("connection reset");
    await issue();
    const [v] = await versions();
    expect(v!.state).toBe("issued");
    expect(chain.attestCalls).toBe(1); // found the existing attestation instead of writing a second one
    expect(v!.txSignature).toBe(`sig-${v!.verificationCode}`);
  });

  it("issues V2 for a new skill while V1 stays valid", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"], ["REC-0002", "Prompt Engineering Fundamentals", "2026-09-21"]);
    await issue();
    await seed(["REC-0029", "AI Data Analysis", "2026-10-14"]);
    await issue();

    const [v1, v2] = await versions();
    expect(v1).toMatchObject({ versionNo: 1, state: "issued", skillCount: 2 });
    expect(v2).toMatchObject({ versionNo: 2, state: "issued", skillCount: 3 });
    expect(v1!.verificationCode).not.toBe(v2!.verificationCode);
    expect(await latestId()).toBe(v2!.id);
    expect(chain.records.size).toBe(2); // both versions stay verifiable on chain
    const [rec] = await db.select().from(skillAwards).where(eq(skillAwards.recordId, "REC-0029"));
    expect(rec?.appliedInVersionId).toBe(v2!.id);
  });

  // what sync does to a pending row when the sheet changes
  const edit = (recordId: string, set: Partial<typeof skillAwards.$inferInsert>) =>
    db.update(skillAwards).set(set).where(eq(skillAwards.recordId, recordId));
  const reject = (recordId: string) => edit(recordId, { verification: "REJECTED", rowHash: `${recordId}-rejected`, state: "ignored" });
  const audit = async (action: string) => (await db.select().from(auditLog).where(eq(auditLog.action, action))).map((a) => a.details);

  it("starts over when a skill is edited while the pdf renders", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    duringRender = () => edit("REC-0001", { skillName: "AI Literacy Advanced", rowHash: "REC-0001-edited" });
    const r = await issue();

    const [v, extra] = await versions();
    expect(r.status === "issued" && r.versionNo).toBe(1); // the cancelled try never became a version
    expect(extra).toBeUndefined();
    expect(renders.map((p) => p.skills[0]!.name)).toEqual(["AI Literacy", "AI Literacy Advanced"]);
    expect(chain.attestCalls).toBe(1); // only the second pdf reached the chain
    expect(v!.skills![0]).toMatchObject({ skillName: "AI Literacy Advanced", rowHash: "REC-0001-edited" });
    expect(await audit("version_cancelled")).toEqual([expect.objectContaining({ versionNo: 1, changedRecords: ["REC-0001"] })]);
  });

  it("issues nothing when the only new skill is rejected while the pdf renders", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    duringRender = () => reject("REC-0001");
    expect(await issue()).toEqual({ status: "nothing-pending" });
    expect(await versions()).toHaveLength(0);
    expect(chain.attestCalls).toBe(0);
    expect((await db.select().from(skillAwards))[0]?.state).toBe("ignored");
  });

  it("keeps a new version's other skills when one of them is rejected mid-render", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    await issue();
    await seed(["REC-0002", "Prompt Engineering Fundamentals", "2026-09-21"], ["REC-0003", "AI Data Analysis", "2026-10-14"]);
    duringRender = () => reject("REC-0003");
    await issue();

    const [, v2] = await versions();
    expect(v2).toMatchObject({ versionNo: 2, state: "issued", skillCount: 2 });
    expect(v2!.includedRecordIds.toSorted()).toEqual(["REC-0001", "REC-0002"]);
    expect(renders.at(-1)!.skills.map((s) => s.name)).toEqual(["AI Literacy", "Prompt Engineering Fundamentals"]);
  });

  it("keeps the ledger equal to the chain when a skill is rejected during the chain write", async () => {
    await seed(["REC-0001", "AI Literacy", "2026-09-18"]);
    chain.duringWrite = () => reject("REC-0001");
    await issue();

    const [v] = await versions();
    expect(v!.state).toBe("issued");
    // put back to what was issued, so the next sync sees the sheet differ and flags it as edited after issue
    expect((await db.select().from(skillAwards))[0]).toMatchObject({
      state: "applied", appliedInVersionId: v!.id, verification: "CONFIRMED", rowHash: "REC-0001",
    });
    expect(await audit("version_issued")).toEqual([expect.objectContaining({ changedDuringIssue: ["REC-0001"] })]);
  });
});
