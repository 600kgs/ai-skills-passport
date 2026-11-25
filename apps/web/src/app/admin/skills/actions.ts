"use server";

import { CATEGORIES, type Category } from "@passport/core";
import { saveSkill as save } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ActionResult } from "../actions";

export type SkillForm = { skillId: string; name: string; category: string; description: string; active: boolean };

// server actions are public endpoints, so each one checks the role itself
export async function saveSkill(f: SkillForm): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  if (!Object.hasOwn(CATEGORIES, f.category)) return { ok: false, message: d.admin.actions.invalid };
  const r = await save(getDb(), { ...f, category: f.category as Category, active: !!f.active }, me.email);
  return r.ok ? { ok: true, message: d.admin.skills.saved } : { ok: false, message: r.error };
}
