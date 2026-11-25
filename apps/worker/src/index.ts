// background worker: applies db migrations, runs the job queue, and re-queues any confirmed skill still waiting.
import { fileURLToPath } from "node:url";
import { ADMIN_QUEUE, type AdminJob, ISSUE_QUEUE, type RevokeResult } from "@passport/core";
import { auditLog, createDb } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import { passportsWaitingToIssue } from "@passport/ledger";
import { PgBoss } from "pg-boss";
import { solanaChain } from "./chain.ts";
import { issuePassport, type IssueDeps } from "./issue.ts";
import { brevoSender, loadNotice, renderMail, shouldEmail } from "./notify.ts";
import { gotenbergRenderer } from "./pdf/render.ts";
import { revokeVersion } from "./revoke.ts";
import { fileStore } from "./storage.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
try {
  process.loadEnvFile(root(".env"));
} catch {} // in production the env comes from docker, not a file

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
};
const SWEEP_EVERY_MS = 60_000;
const NOTIFY_QUEUE = "notify-student";

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
// created before any issue job runs, so a finished issue can always queue its email
await boss.createQueue(NOTIFY_QUEUE, { retryLimit: 4, retryDelay: 60, retryBackoff: true });

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
  if (r.status === "issued") {
    console.log(`issued ${r.passportId} V${r.versionNo} (${r.code}) -> ${r.attestation}`);
    // the student hears about it from a job of its own: a mail problem can't fail or repeat an issue
    await boss.send(NOTIFY_QUEUE, { code: r.code }, { singletonKey: r.code }).catch((e) => console.error(`couldn't queue the email for ${r.code}:`, e));
  }
  return r;
});

// optional: without a brevo key (local dev, tests) nothing is mailed
const mailKey = process.env.BREVO_API_KEY;
const sendMail = mailKey ? brevoSender(mailKey, { email: env("MAIL_FROM_EMAIL"), name: process.env.MAIL_FROM_NAME ?? "BTU AI Skills Passport" }) : null;
await boss.work<{ code: string }>(NOTIFY_QUEUE, async ([job]) => {
  const n = await loadNotice(db, job!.data.code);
  if (!n) return { skipped: "no issued version" };
  if (!shouldEmail(n.email)) return { skipped: "test address" };
  if (!sendMail) return { skipped: "mail not configured" };
  const messageId = await sendMail(renderMail(n, deps.publicBaseUrl));
  await db.insert(auditLog).values({ actor: "system", action: "student_notified", subject: n.passportId, details: { version: n.versionNo, messageId } });
  console.log(`notified ${n.passportId} V${n.versionNo}`);
  return { messageId };
});
console.log("worker ready, queue running");

// the admin pages queue an issue right after each write; this catches any that got lost on the way
// (the worker was down, the queue message failed), and is the only thing that runs on a timer
async function sweep() {
  try {
    for (const passportId of await passportsWaitingToIssue(db)) await boss.send(ISSUE_QUEUE, { passportId }, { singletonKey: passportId });
  } catch (e) {
    console.error("sweep failed:", (e as Error).message);
  }
}
void sweep();
const timer = setInterval(() => void sweep(), SWEEP_EVERY_MS);

// admin jobs need the issuer key, which only the worker holds. they fail fast instead of retrying:
// the admin sees the reason and decides
await boss.createQueue(ADMIN_QUEUE, { retryLimit: 0 });
await boss.work<AdminJob>(ADMIN_QUEUE, { pollingIntervalSeconds: 1 }, async ([job]): Promise<RevokeResult> => {
  const j = job!.data;
  const r = await revokeVersion(db, deps.chain, { code: j.code, reason: j.reason, withdraw: j.withdraw, by: j.by });
  console.log(`revoked ${r.passportId} V${r.versionNo} for ${j.by}${r.withdrawn.length ? `, withdrew ${r.withdrawn.join(", ")}` : ""}`);
  if (r.reissue) await boss.send(ISSUE_QUEUE, { passportId: r.passportId }, { singletonKey: r.passportId });
  return r;
});

async function shutdown() {
  clearInterval(timer);
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
