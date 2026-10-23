import "server-only";
import { ADMIN_QUEUE, type AdminJob } from "@passport/core";
import { PgBoss } from "pg-boss";

// send-only: the worker owns the queue's schema, maintenance and the jobs themselves
const g = globalThis as unknown as { passportBoss?: Promise<PgBoss> };
const boss = () => (g.passportBoss ??= (async () => {
  const b = new PgBoss({ connectionString: process.env.DATABASE_URL, supervise: false, schedule: false, migrate: false, createSchema: false });
  b.on("error", (e) => console.error("queue error:", e));
  await b.start();
  return b;
})());

export type JobOutcome<R> = { state: "done"; result: R } | { state: "failed"; error: string } | { state: "waiting" };

// queue an admin job and wait a few seconds for the worker's answer, so the page can say what happened
export async function runAdminJob<R>(job: AdminJob, waitMs = 8000): Promise<JobOutcome<R>> {
  const b = await boss();
  const id = await b.send(ADMIN_QUEUE, job);
  if (!id) return { state: "failed", error: "the queue didn't accept the job" };
  for (const end = Date.now() + waitMs; Date.now() < end;) {
    await new Promise((r) => setTimeout(r, 400));
    const j = await b.getJobById<AdminJob>(ADMIN_QUEUE, id);
    if (j?.state === "completed") return { state: "done", result: j.output as R };
    if (j?.state === "failed") return { state: "failed", error: (j.output as { message?: string } | null)?.message ?? "the worker couldn't do it" };
  }
  return { state: "waiting" };
}
