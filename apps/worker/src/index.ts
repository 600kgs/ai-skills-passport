// background worker: applies db migrations, runs the job queue, and polls the sheet.
import { fileURLToPath } from "node:url";
import { ADMIN_QUEUE, type AdminJob, type AdminJobResult } from "@passport/core";
import { auditLog, createDb, syncRuns } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import { PgBoss } from "pg-boss";
import { solanaChain } from "./chain.ts";
import { issuePassport, type IssueDeps } from "./issue.ts";
import { gotenbergRenderer } from "./pdf/render.ts";
import { setRecordStatus } from "./sheet-status.ts";
import { googleSheet } from "./sheets.ts";
import { fileStore } from "./storage.ts";
import { runSync, type SyncSummary } from "./sync.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
try {
  process.loadEnvFile(root(".env"));
} catch {} // in production the env comes from docker, not a file

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
};
const SYNC_EVERY_MS = 15_000;
export const ISSUE_QUEUE = "issue-passport";

const url = env("DATABASE_URL");
const { db, pool } = createDb(url);
await runMigrations(db);
console.log("db migrations applied");

const boss = new PgBoss(url);
boss.on("error", (e) => console.error("queue error:", e));
await boss.start();
// one queued + one running job per passport; a skill arriving mid-issue gets the next run.
// failures retry with backoff, and each retry resumes the same unfinished version
await boss.createQueue(ISSUE_QUEUE, { policy: "stately", retryLimit: 5, retryDelay: 15, retryBackoff: true });

const path = (name: string) => {
  const p = env(name);
  return p.startsWith(".") ? root(p) : p;
};
const deps: IssueDeps = {
  render: gotenbergRenderer(env("GOTENBERG_URL")),
  store: fileStore(path("STORAGE_DIR")),
  publicBaseUrl: env("PUBLIC_BASE_URL"),
  chain: await solanaChain({
    rpcUrl: env("SOLANA_RPC_URL"), wsUrl: env("SOLANA_WS_URL"),
    issuerKeyFile: path("ISSUER_KEY_FILE"), authorityAddress: env("AUTHORITY_ADDRESS"),
  }),
};
await boss.work<{ passportId: string }>(ISSUE_QUEUE, async ([job]) => {
  const r = await issuePassport(db, deps, job!.data.passportId);
  if (r.status === "issued") console.log(`issued ${r.passportId} V${r.versionNo} (${r.code}) -> ${r.attestation}`);
  return r;
});
console.log("worker ready, queue running");

const sheet = googleSheet(env("SHEET_ID"), path("GOOGLE_SERVICE_ACCOUNT_FILE"));
const enqueue = async (passportId: string) => { await boss.send(ISSUE_QUEUE, { passportId }, { singletonKey: passportId }); };

let running: Promise<SyncSummary> | null = null;
let lastError: string | null = null;
// one sync at a time. a poll skips if one is running; an admin's sync waits for it, then runs fresh
async function sync(trigger: "poll" | "manual"): Promise<SyncSummary | null> {
  if (running && trigger === "poll") return null;
  while (running) await running.catch(() => {});
  running = runSync(db, sheet, { trigger, enqueue });
  try {
    const s = await running;
    lastError = null;
    // quiet runs stay quiet; anything that changed gets one log line
    if (s.newRecords || s.updatedRecords || s.newPassports || s.cellsWritten) {
      console.log(`sync: ${s.newRecords} new, ${s.updatedRecords} updated, ${s.newPassports} new passports, ${s.failedRows} failed rows, ${s.cellsWritten} cells written, queued ${s.queued.length}`);
    }
    return s;
  } catch (e) {
    const message = (e as Error).message;
    console.error("sync failed:", message);
    // the admin page shows failures; log each new one once, not every 15 s while google is down
    if (message !== lastError) await db.insert(syncRuns).values({ trigger, finishedAt: new Date(), error: message }).catch(() => {});
    lastError = message;
    if (trigger === "manual") throw e;
    return null;
  } finally {
    running = null;
  }
}
const tick = () => void sync("poll");
tick();
const timer = setInterval(tick, SYNC_EVERY_MS);

// admin jobs fail fast instead of retrying: the admin sees the reason and decides
await boss.createQueue(ADMIN_QUEUE, { retryLimit: 0 });
await boss.work<AdminJob>(ADMIN_QUEUE, { pollingIntervalSeconds: 1 }, async ([job]): Promise<AdminJobResult> => {
  const j = job!.data;
  if (j.kind === "set-status") {
    const { row } = await setRecordStatus(sheet, j.recordId, j.status);
    await db.insert(auditLog).values({
      actor: j.by, action: j.status === "CONFIRMED" ? "record_confirmed" : "record_rejected", subject: j.recordId, details: { row },
    });
  } else {
    await db.insert(auditLog).values({ actor: j.by, action: "sync_requested" });
  }
  const s = (await sync("manual"))!;
  return { newRecords: s.newRecords, updatedRecords: s.updatedRecords, failedRows: s.failedRows, queued: s.queued.length };
});

async function shutdown() {
  clearInterval(timer);
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
