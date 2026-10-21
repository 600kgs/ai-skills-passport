// background worker: applies db migrations, then runs the job queue.
// sync, pdf and chain jobs get registered here as they're built.
import { fileURLToPath } from "node:url";
import { createDb, runMigrations } from "@passport/db";
import { PgBoss } from "pg-boss";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {} // in production the env comes from docker, not a file

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

const { db, pool } = createDb(url);
await runMigrations(db);
console.log("db migrations applied");

const boss = new PgBoss(url);
boss.on("error", (e) => console.error("queue error:", e));
await boss.start();
console.log("worker ready, queue running");

async function shutdown() {
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
