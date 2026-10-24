import "server-only";
import {
  ACTIVITY_PER_PAGE, ACTIVITY_TYPES, type ActivityFilters, authorizedSigners, normalizeCode, type PassportFilters, PASSPORTS_PER_PAGE,
} from "@passport/core";
import { and, auditLog, desc, eq, inArray, lt, passports, passportVersions, skillAwards, type SQL, sql, students, syncRuns } from "@passport/db";
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
  // the key the chain accepts right now, not whoever signed last: right after a rotation they differ
  const signer = await currentSigner();
  const balance = signer ? await solBalance(signer) : null;
  return {
    counts: counts!,
    lastRun: lastRun ?? null,
    problems: lastProblems?.problems ?? [],
    issuer: signer ? { address: signer, balance, issuesLeft: balance === null ? null : Math.floor(balance / SOL_PER_ISSUE) } : null,
  };
}

async function currentSigner(): Promise<string | null> {
  const authority = process.env.AUTHORITY_ADDRESS;
  if (!authority) return null;
  try {
    return (await authorizedSigners(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", authority))[0] ?? null;
  } catch {
    return null;
  }
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

// a search term inside ilike, its own % and _ matched literally
const contains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// one page of passports with their latest version, searched, filtered and sorted in the database
export async function listPassports(f: PassportFilters) {
  const db = getDb();
  const conds: SQL[] = [];
  if (f.q) {
    const like = contains(f.q);
    const code = normalizeCode(f.q);
    conds.push(sql`(${students.firstName} || ' ' || ${students.lastName} ilike ${like}
      or ${students.email} ilike ${like} or ${students.studentId} ilike ${like} or ${passports.passportId} ilike ${like}
      or exists (select 1 from passport_versions v where v.passport_id = ${passports.passportId}
        and (v.verification_code ilike ${like} or v.verification_code = ${code ?? ""})))`);
  }
  if (f.program) conds.push(eq(students.program, f.program));
  if (f.level) conds.push(eq(students.educationLevel, f.level));
  if (f.updated === "yes") conds.push(sql`${passportVersions.versionNo} > 1`);
  if (f.updated === "no") conds.push(sql`${passportVersions.versionNo} = 1`);
  const where = conds.length ? and(...conds) : undefined;

  const order = {
    newest: [sql`${passportVersions.issuedAt} desc nulls last`, passports.passportId],
    name: [students.lastName, students.firstName, passports.passportId],
    id: [passports.passportId],
    versions: [sql`${passportVersions.versionNo} desc nulls last`, passports.passportId],
  }[f.sort];

  const base = () => db.select({ n: sql<number>`count(*)::int` }).from(passports)
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .leftJoin(passportVersions, eq(passportVersions.id, passports.latestVersionId));
  const [[counted], rows] = await Promise.all([
    base().where(where),
    db.select({
      passportId: passports.passportId, firstIssued: passports.firstIssued,
      firstName: students.firstName, lastName: students.lastName, email: students.email,
      versionNo: passportVersions.versionNo, code: passportVersions.verificationCode,
      issuedAt: passportVersions.issuedAt, skillCount: passportVersions.skillCount,
    })
      .from(passports)
      .innerJoin(students, eq(students.studentId, passports.studentId))
      .leftJoin(passportVersions, eq(passportVersions.id, passports.latestVersionId))
      .where(where)
      .orderBy(...order)
      .limit(PASSPORTS_PER_PAGE)
      .offset((f.page - 1) * PASSPORTS_PER_PAGE),
  ]);
  const total = counted?.n ?? 0;
  return { rows, total, pages: Math.max(1, Math.ceil(total / PASSPORTS_PER_PAGE)) };
}

// the values the program and level filters offer: whatever the sheet actually holds
export async function passportFilterOptions() {
  const db = getDb();
  const [programs, levels] = await Promise.all([
    db.selectDistinct({ v: students.program }).from(students).orderBy(students.program),
    db.selectDistinct({ v: students.educationLevel }).from(students).orderBy(students.educationLevel),
  ]);
  return { programs: programs.map((r) => r.v), levels: levels.map((r) => r.v) };
}

// everything about one passport: the student, every version, every skill record and what happened to them
export async function passportDetail(passportId: string) {
  const db = getDb();
  const [row] = await db.select({ passport: passports, student: students }).from(passports)
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .where(eq(passports.passportId, passportId));
  if (!row) return null;
  const [versions, records] = await Promise.all([
    db.select().from(passportVersions).where(eq(passportVersions.passportId, passportId)).orderBy(desc(passportVersions.versionNo)),
    db.select().from(skillAwards).where(eq(skillAwards.studentId, row.student.studentId)).orderBy(skillAwards.recordId),
  ]);
  const subjects = [passportId, ...records.map((r) => r.recordId)];
  const history = await db.select().from(auditLog).where(inArray(auditLog.subject, subjects)).orderBy(desc(auditLog.id)).limit(200);
  const versionNoById = new Map(versions.map((v) => [v.id, v.versionNo]));
  return {
    ...row,
    versions,
    records: records.map((r) => ({ ...r, appliedIn: r.appliedInVersionId ? versionNoById.get(r.appliedInVersionId) ?? null : null })),
    history,
  };
}

// one page of each log, newest first; "older" pages by id, so paging stays fast however long the log grows
export async function activityPage(f: ActivityFilters) {
  const db = getDb();
  const auditConds: SQL[] = [];
  if (f.type) auditConds.push(inArray(auditLog.action, [...ACTIVITY_TYPES[f.type]]));
  if (f.q) auditConds.push(sql`${auditLog.subject} ilike ${contains(f.q)}`);
  if (f.before) auditConds.push(lt(auditLog.id, f.before));
  const runConds: SQL[] = [];
  if (f.problemsOnly) runConds.push(sql`(${syncRuns.error} is not null or ${syncRuns.failedRecords} > 0)`);
  if (f.runsBefore) runConds.push(lt(syncRuns.id, f.runsBefore));

  // one extra row tells whether an older page exists
  const [audit, runs] = await Promise.all([
    db.select().from(auditLog).where(auditConds.length ? and(...auditConds) : undefined).orderBy(desc(auditLog.id)).limit(ACTIVITY_PER_PAGE + 1),
    db.select().from(syncRuns).where(runConds.length ? and(...runConds) : undefined).orderBy(desc(syncRuns.id)).limit(ACTIVITY_PER_PAGE + 1),
  ]);
  // which subjects are passports that exist, so the page can link them
  const ids = [...new Set(audit.map((a) => a.subject).filter((s): s is string => !!s && s.startsWith("BTU-AI-")))];
  const known = ids.length ? await db.select({ id: passports.passportId }).from(passports).where(inArray(passports.passportId, ids)) : [];
  return {
    audit: audit.slice(0, ACTIVITY_PER_PAGE),
    olderAudit: audit.length > ACTIVITY_PER_PAGE ? audit[ACTIVITY_PER_PAGE - 1]!.id : null,
    runs: runs.slice(0, ACTIVITY_PER_PAGE),
    olderRuns: runs.length > ACTIVITY_PER_PAGE ? runs[ACTIVITY_PER_PAGE - 1]!.id : null,
    passportIds: new Set(known.map((k) => k.id)),
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
