import "server-only";
import { auditLog, desc, eq, passports, passportVersions, skillAwards, sql, students, syncRuns } from "@passport/db";
import { getDb } from "@/lib/db";

const SOL_PER_ISSUE = 0.0017; // measured on devnet, 2026-10-22

export async function overview() {
  const db = getDb();
  const [counts] = (await db.execute<{ students: number; passports: number; issued: number; in_progress: number; failed: number }>(sql`
    select (select count(*) from students)::int as students,
           (select count(*) from passports)::int as passports,
           (select count(*) from passport_versions where state = 'issued')::int as issued,
           (select count(*) from passport_versions where state in ('rendering', 'anchoring'))::int as in_progress,
           (select count(*) from passport_versions where state = 'failed')::int as failed`)).rows;
  const [lastRun] = await db.select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(1);
  const [lastProblems] = await db.select().from(syncRuns).where(sql`${syncRuns.error} is null`).orderBy(desc(syncRuns.id)).limit(1);
  const [latest] = await db.select({ signer: passportVersions.signer }).from(passportVersions)
    .where(eq(passportVersions.state, "issued")).orderBy(desc(passportVersions.issuedAt)).limit(1);
  const balance = latest?.signer ? await solBalance(latest.signer) : null;
  return {
    counts: counts!,
    lastRun: lastRun ?? null,
    problems: lastProblems?.problems ?? [],
    issuer: latest?.signer ? { address: latest.signer, balance, issuesLeft: balance === null ? null : Math.floor(balance / SOL_PER_ISSUE) } : null,
  };
}

// records waiting for someone at btu to confirm or reject them
export async function pendingRecords() {
  return getDb().select({
    recordId: skillAwards.recordId, skillName: skillAwards.skillName, category: skillAwards.category, dateEarned: skillAwards.dateEarned,
    studentId: students.studentId, firstName: students.firstName, lastName: students.lastName, passportId: passports.passportId,
  })
    .from(skillAwards)
    .innerJoin(students, eq(students.studentId, skillAwards.studentId))
    .leftJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(eq(skillAwards.verification, "PENDING"))
    .orderBy(skillAwards.recordId);
}

export async function allPassports() {
  return getDb().select({
    passportId: passports.passportId, firstIssued: passports.firstIssued,
    firstName: students.firstName, lastName: students.lastName, email: students.email,
    versionNo: passportVersions.versionNo, code: passportVersions.verificationCode,
    issuedAt: passportVersions.issuedAt, skillCount: passportVersions.skillCount,
  })
    .from(passports)
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .leftJoin(passportVersions, eq(passportVersions.id, passports.latestVersionId))
    .orderBy(passports.passportId);
}

export async function activity() {
  const db = getDb();
  return {
    runs: await db.select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(30),
    audit: await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(60),
  };
}

// public data, read straight from the chain; null if solana doesn't answer
async function solBalance(address: string): Promise<number | null> {
  try {
    const res = await fetch(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      signal: AbortSignal.timeout(4000),
    });
    const body = (await res.json()) as { result?: { value: number } };
    return body.result ? body.result.value / 1e9 : null;
  } catch {
    return null;
  }
}
