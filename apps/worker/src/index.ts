// background worker: applies db migrations, runs the job queue, and polls the sheet.
import { fileURLToPath } from "node:url";
import { createDb, runMigrations } from "@passport/db";
import { PgBoss } from "pg-boss";
import { googleSheet } from "./sheets.ts";
import { runSync } from "./sync.ts";

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
// one queued + one running job per passport; a skill arriving mid-issue gets the next run
await boss.createQueue(ISSUE_QUEUE, { policy: "stately" });
console.log("worker ready, queue running");

const keyFile = env("GOOGLE_SERVICE_ACCOUNT_FILE");
const sheet = googleSheet(env("SHEET_ID"), keyFile.startsWith(".") ? root(keyFile) : keyFile);
const enqueue = async (passportId: string) => { await boss.send(ISSUE_QUEUE, { passportId }, { singletonKey: passportId }); };

let syncing = false;
async function tick() {
  if (syncing) return;
  syncing = true;
  try {
    const s = await runSync(db, sheet, { trigger: "poll", enqueue });
    // quiet runs stay quiet; anything that changed gets one log line
    if (s.newRecords || s.updatedRecords || s.newPassports || s.cellsWritten) {
      console.log(`sync: ${s.newRecords} new, ${s.updatedRecords} updated, ${s.newPassports} new passports, ${s.failedRows} failed rows, ${s.cellsWritten} cells written, queued ${s.queued.length}`);
    }
  } catch (e) {
    console.error("sync failed:", (e as Error).message);
  } finally {
    syncing = false;
  }
}
await tick();
const timer = setInterval(tick, SYNC_EVERY_MS);

async function shutdown() {
  clearInterval(timer);
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
