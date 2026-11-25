"use server";

import { WORKSHOP_KINDS, WORKSHOP_STATUSES, type WorkshopInput, type WorkshopStatus } from "@passport/core";
import { saveWorkshop as save, setWorkshopStatus } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ActionResult } from "../actions";

export type SaveResult = ActionResult & { id?: number };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

// server actions are public endpoints, so each one checks the role itself
export async function saveWorkshop(id: number | null, w: WorkshopInput): Promise<SaveResult> {
  const d = await getDict();
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  const input: WorkshopInput = {
    kind: (WORKSHOP_KINDS as readonly string[]).includes(w.kind) ? w.kind : "workshop",
    title: str(w.title), titleEn: opt(w.titleEn), description: str(w.description), descriptionEn: opt(w.descriptionEn),
    trainer: str(w.trainer), startsAt: str(w.startsAt), endsAt: opt(w.endsAt), location: str(w.location),
    skillId: opt(w.skillId), registrationUrl: str(w.registrationUrl),
  };
  const r = await save(getDb(), typeof id === "number" ? id : null, input, me.email);
  return r.ok ? { ok: true, message: d.admin.workshops.saved, id: r.value } : { ok: false, message: r.error };
}

export async function changeStatus(id: number, status: WorkshopStatus): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  if (!(WORKSHOP_STATUSES as readonly string[]).includes(status)) return { ok: false, message: d.admin.actions.invalid };
  const r = await setWorkshopStatus(getDb(), Number(id), status, me.email);
  return r.ok ? { ok: true, message: d.admin.workshops.statusSaved[status] } : { ok: false, message: r.error };
}
