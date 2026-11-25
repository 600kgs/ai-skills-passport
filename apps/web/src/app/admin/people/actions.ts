"use server";

import { bootstrapEmails, type Role, ROLES } from "@passport/core";
import { removeStaff, setStaffRole } from "@passport/ledger";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ActionResult } from "../actions";

// server actions are public endpoints, so each one checks the role itself
export async function saveStaff(email: string, role: Role): Promise<ActionResult> {
  const t = (await getDict()).admin.people;
  const me = await currentStaff("superadmin");
  if (!me) return { ok: false, message: t.onlySuperadmins };
  if (!ROLES.includes(role)) return { ok: false, message: t.invalidRole };
  const r = await setStaffRole(getDb(), { email, role, by: me.email, bootstrap: bootstrapEmails(process.env.ADMIN_EMAILS) });
  return r.ok ? { ok: true, message: fill(t.added, { email: email.trim().toLowerCase() }) } : { ok: false, message: r.error };
}

export async function deleteStaff(email: string): Promise<ActionResult> {
  const t = (await getDict()).admin.people;
  const me = await currentStaff("superadmin");
  if (!me) return { ok: false, message: t.onlySuperadmins };
  const r = await removeStaff(getDb(), { email, by: me.email, bootstrap: bootstrapEmails(process.env.ADMIN_EMAILS) });
  return r.ok ? { ok: true, message: fill(t.removed, { email }) } : { ok: false, message: r.error };
}
