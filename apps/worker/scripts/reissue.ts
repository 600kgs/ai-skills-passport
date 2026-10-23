// wipes the issuance ledger so the worker issues every passport again from the sheet.
// for synthetic data only: every verification code changes and old codes stop resolving.
// passport ids and first-issued dates survive, because sync takes them from the sheet.
// stop the worker first, then:
//   pnpm --filter @passport/worker reissue          (dry run, prints what would go)
//   pnpm --filter @passport/worker reissue --yes
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSolanaRpc } from "@solana/kit";
import { createDb, sql } from "@passport/db";
import { loadSigner } from "../src/chain.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
try {
  process.loadEnvFile(root(".env"));
} catch {} // in production the env comes from docker
const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v.startsWith(".") ? root(v) : v;
};
const ISSUE_QUEUE = "issue-passport";
const SOL_PER_ISSUE = 0.0017; // measured on devnet, 2026-10-22

const confirmed = process.argv.includes("--yes");
const { db, pool } = createDb(env("DATABASE_URL"));
const pdfDir = join(env("STORAGE_DIR"), "pdfs");

const count = async (q: ReturnType<typeof sql>) => Number((await db.execute<{ n: string }>(q)).rows[0]!.n);
const queueExists = (await db.execute(sql`select 1 from information_schema.tables where table_schema = 'pgboss' and table_name = 'job'`)).rows.length > 0;
const activeJobs = queueExists ? await count(sql`select count(*) as n from pgboss.job where name = ${ISSUE_QUEUE} and state = 'active'`) : 0;
const pdfs = (await readdir(pdfDir).catch(() => [] as string[])).filter((f) => f.endsWith(".pdf"));
const stats = {
  students: await count(sql`select count(*) as n from students`),
  passports: await count(sql`select count(*) as n from passports`),
  versions: await count(sql`select count(*) as n from passport_versions`),
  awards: await count(sql`select count(*) as n from skill_awards`),
  pdfs: pdfs.length,
};

const issuer = await loadSigner(env("ISSUER_KEY_FILE"));
const { value: lamports } = await createSolanaRpc(env("SOLANA_RPC_URL")).getBalance(issuer.address).send();
const balance = Number(lamports) / 1e9;
const needed = stats.passports * SOL_PER_ISSUE;

console.log(`ledger:  ${stats.students} students, ${stats.passports} passports, ${stats.versions} versions, ${stats.awards} skill records`);
console.log(`storage: ${stats.pdfs} pdfs in ${pdfDir}`);
console.log(`issuer:  ${balance.toFixed(4)} SOL, reissue needs ~${needed.toFixed(4)} SOL`);

let exitCode = 0;
if (activeJobs > 0) {
  console.error(`refusing: ${activeJobs} issue job(s) running. stop the worker first`);
  exitCode = 1;
} else if (balance < needed * 1.5) {
  // a half-funded run leaves passports failed mid-issue; top up first
  console.error("refusing: issuer balance too low, fund it at faucet.solana.com");
  exitCode = 1;
} else if (!confirmed) {
  console.log("dry run. add --yes to wipe and reissue");
} else {
  // pdfs first: a pdf without a ledger row is harmless, a ledger row without its pdf is not
  for (const f of pdfs) await rm(join(pdfDir, f));
  await db.transaction(async (tx) => {
    // same lock sync takes, so a worker someone forgot to stop can't sync mid-wipe
    const lock = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('passport-sync')) as locked`);
    if (!lock.rows[0]?.locked) throw new Error("a sync is running; stop the worker first");
    if (queueExists) await tx.execute(sql`delete from pgboss.job where name = ${ISSUE_QUEUE}`);
    // no cascade on purpose: a new table pointing at these should make this fail, not vanish silently
    await tx.execute(sql`truncate passport_versions, skill_awards, passports, students, sync_runs, audit_log restart identity`);
    await tx.execute(sql`insert into audit_log (actor, action, details) values ('system', 'ledger_reset', ${JSON.stringify(stats)}::jsonb)`);
  });
  console.log("wiped. start the worker; the next sync reissues everything");
  // the old versions' attestations stay on chain and still match their old pdfs until they're closed
  console.log("once the reissue is done, close the old attestations: scripts/audit-chain.ts --close");
}
await pool.end();
process.exit(exitCode);
