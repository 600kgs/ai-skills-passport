"use server";

import type { SyncResult } from "@passport/core";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentAdmin } from "@/lib/auth";
import { runAdminJob, type JobOutcome } from "@/lib/queue";

export type ActionResult = { ok: boolean; message: string };

// server actions are public endpoints, so each one checks the admin itself
export async function decideRecord(recordId: string, status: "CONFIRMED" | "REJECTED"): Promise<ActionResult> {
  const t = (await getDict()).admin.actions;
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: t.onlyAdmins };
  if (!/^REC-\d+$/.test(recordId) || !["CONFIRMED", "REJECTED"].includes(status)) return { ok: false, message: t.invalid };

  const outcome = await runAdminJob<SyncResult>({ kind: "set-status", recordId, status, by: admin.email });
  if (outcome.state !== "done") return notDone(outcome, t);
  if (status === "REJECTED") return { ok: true, message: fill(t.rejected, { rec: recordId }) };
  return { ok: true, message: fill(outcome.result.queued ? t.confirmedIssuing : t.confirmed, { rec: recordId }) };
}

export async function syncNow(): Promise<ActionResult> {
  const d = await getDict();
  const t = d.admin.actions;
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: t.onlyAdmins };
  const outcome = await runAdminJob<SyncResult>({ kind: "sync", by: admin.email });
  if (outcome.state !== "done") return notDone(outcome, t);
  const r = outcome.result;
  const fix = r.failedRows ? fill(t.needFix, { n: r.failedRows, rows: r.failedRows === 1 ? d.admin.rowOne : d.admin.rowMany }) : "";
  return { ok: true, message: (r.newRecords || r.updatedRecords ? fill(t.synced, { new: r.newRecords, changed: r.updatedRecords }) : t.syncedNothing) + fix };
}

const notDone = (o: Exclude<JobOutcome<SyncResult>, { state: "done" }>, t: Awaited<ReturnType<typeof getDict>>["admin"]["actions"]): ActionResult =>
  o.state === "failed" ? { ok: false, message: fill(t.refused, { error: o.error }) } : { ok: true, message: t.waiting };
