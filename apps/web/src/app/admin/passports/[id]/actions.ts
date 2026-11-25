"use server";

import type { RevokeResult } from "@passport/core";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { enqueueIssue, runAdminJob } from "@/lib/queue";
import type { ActionResult } from "../../actions";

// server actions are public endpoints, so each one checks the role itself.
// the chain step needs the issuer key, so the worker does the revoke and the page waits for its answer
export async function revoke(code: string, reason: string, withdraw: string[]): Promise<ActionResult> {
  const d = await getDict();
  const t = d.admin.revoke;
  const me = await currentStaff("superadmin");
  if (!me) return { ok: false, message: t.onlySuperadmins };
  const clean = (Array.isArray(withdraw) ? withdraw : []).map(String).filter((id) => /^REC-\d+$/.test(id));
  if (!String(reason ?? "").trim()) return { ok: false, message: t.needReason };
  const out = await runAdminJob<RevokeResult>({ kind: "revoke", code: String(code), reason: String(reason).trim(), withdraw: clean, by: me.email }, 30000);
  if (out.state === "failed") return { ok: false, message: fill(d.admin.actions.refused, { error: out.error }) };
  if (out.state === "waiting") return { ok: true, message: d.admin.actions.waiting };
  const r = out.result;
  return { ok: true, message: fill(r.reissue ? t.doneReissue : t.done, { v: r.versionNo }) + (r.chainClosed ? "" : t.chainAlready) };
}

export async function retry(passportId: string): Promise<ActionResult> {
  const d = await getDict();
  if (!(await currentStaff("superadmin"))) return { ok: false, message: d.admin.revoke.onlySuperadmins };
  if (!/^BTU-AI-\d{6}$/.test(String(passportId))) return { ok: false, message: d.admin.actions.invalid };
  await enqueueIssue([passportId]);
  return { ok: true, message: d.admin.revoke.retried };
}
