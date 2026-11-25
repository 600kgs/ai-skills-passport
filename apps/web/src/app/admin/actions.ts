"use server";

import { decideRecord as decide } from "@passport/ledger";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { enqueueIssue } from "@/lib/queue";

export type ActionResult = { ok: boolean; message: string };

// server actions are public endpoints, so each one checks the admin itself
export async function decideRecord(recordId: string, status: "CONFIRMED" | "REJECTED"): Promise<ActionResult> {
  const t = (await getDict()).admin.actions;
  const admin = await currentStaff("admin");
  if (!admin) return { ok: false, message: t.onlyAdmins };
  if (!/^REC-\d+$/.test(recordId) || !["CONFIRMED", "REJECTED"].includes(status)) return { ok: false, message: t.invalid };

  const r = await decide(getDb(), recordId, status, admin.email);
  if (!r.ok) return { ok: false, message: r.error };
  await enqueueIssue(r.value.queue);
  if (status === "REJECTED") return { ok: true, message: fill(t.rejected, { rec: recordId }) };
  return { ok: true, message: fill(r.value.queue.length ? t.confirmedIssuing : t.confirmed, { rec: recordId }) };
}
