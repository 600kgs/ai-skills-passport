"use server";

import { currentAdmin } from "@/lib/auth";
import { runAdminJob, type JobOutcome } from "@/lib/queue";

export type ActionResult = { ok: boolean; message: string };

const describe = (o: JobOutcome, done: string): ActionResult =>
  o.state === "done" ? { ok: true, message: done }
  : o.state === "failed" ? { ok: false, message: `The worker refused: ${o.error}.` }
  : { ok: true, message: "Sent. The worker hasn't answered yet; refresh in a few seconds." };

// server actions are public endpoints, so each one checks the admin itself
export async function decideRecord(recordId: string, status: "CONFIRMED" | "REJECTED"): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Only admins can confirm or reject records." };
  if (!/^REC-\d+$/.test(recordId) || !["CONFIRMED", "REJECTED"].includes(status)) return { ok: false, message: "That isn't a valid record or decision." };

  const outcome = await runAdminJob({ kind: "set-status", recordId, status, by: admin.email });
  if (outcome.state === "done" && status === "CONFIRMED") {
    return describe(outcome, outcome.result.queued
      ? `Confirmed ${recordId}. The passport is being reissued with it now.`
      : `Confirmed ${recordId}.`);
  }
  return describe(outcome, `Rejected ${recordId}. It stays out of the passport.`);
}

export async function syncNow(): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Only admins can start a sync." };
  const outcome = await runAdminJob({ kind: "sync", by: admin.email });
  if (outcome.state !== "done") return describe(outcome, "");
  const r = outcome.result;
  return describe(outcome, r.newRecords || r.updatedRecords
    ? `Synced: ${r.newRecords} new and ${r.updatedRecords} changed records${r.failedRows ? `, ${r.failedRows} rows need fixing` : ""}.`
    : `Synced. Nothing new in the sheet${r.failedRows ? `; ${r.failedRows} rows still need fixing` : ""}.`);
}
