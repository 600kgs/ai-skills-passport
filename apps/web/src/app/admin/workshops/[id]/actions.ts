"use server";

import { parseCsv, parseRegistrations, UPLOAD_MAX_BYTES } from "@passport/core";
import { createWorkshopRecords, renameRegistration, saveRegistrations, setPassed } from "@passport/ledger";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readGrids } from "@/lib/xlsx";
import type { ActionResult } from "../../actions";

// server actions are public endpoints, so each one checks the role itself
export async function uploadRegistrations(workshopId: number, form: FormData): Promise<ActionResult> {
  const d = await getDict();
  const t = d.admin.registrations;
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: d.admin.upload.chooseFile };
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, message: d.admin.upload.tooBig };
  const name = file.name.toLowerCase();
  let grids: string[][][];
  try {
    if (name.endsWith(".csv")) grids = [parseCsv(await file.text())];
    else if (name.endsWith(".xlsx")) grids = await readGrids(Buffer.from(await file.arrayBuffer()));
    else return { ok: false, message: t.onlyFiles };
  } catch {
    return { ok: false, message: d.admin.upload.unreadable };
  }
  // the first tab that has an email column
  const parsed = grids.map(parseRegistrations).find((p) => !p.error) ?? parseRegistrations(grids[0] ?? []);
  if (parsed.error) return { ok: false, message: parsed.error };
  const bad = parsed.rows.filter((r) => r.errors.length);
  const r = await saveRegistrations(getDb(), Number(workshopId), parsed.rows, me.email);
  if (!r.ok) return { ok: false, message: r.error };
  return {
    ok: true,
    message: fill(t.uploaded, { added: r.value.added, updated: r.value.updated })
      + (bad.length ? fill(t.skippedRows, { list: bad.map((b) => `${b.line}: ${b.errors.join("; ")}`).join(", ") }) : ""),
  };
}

export async function markPassed(workshopId: number, ids: number[], passed: boolean): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const r = await setPassed(getDb(), Number(workshopId), clean, !!passed, me.email);
  return r.ok ? { ok: true, message: d.admin.registrations.saved } : { ok: false, message: r.error };
}

export async function makeRecords(workshopId: number): Promise<ActionResult> {
  const d = await getDict();
  const t = d.admin.registrations;
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  const r = await createWorkshopRecords(getDb(), Number(workshopId), me.email);
  if (!r.ok) return { ok: false, message: r.error };
  const { created, rejected } = r.value;
  return {
    ok: rejected.length === 0,
    message: fill(t.created, { n: created.length })
      + (rejected.length ? fill(t.notCreated, { list: rejected.map((x) => `${x.email}: ${x.errors.join("; ")}`).join(", ") }) : ""),
  };
}

export async function renameReg(workshopId: number, id: number, firstName: string, lastName: string): Promise<ActionResult> {
  const d = await getDict();
  const me = await currentStaff("editor");
  if (!me) return { ok: false, message: d.admin.workshops.onlyEditors };
  const r = await renameRegistration(getDb(), Number(workshopId), Number(id), String(firstName ?? ""), String(lastName ?? ""), me.email);
  return r.ok ? { ok: true, message: d.admin.registrations.nameSaved } : { ok: false, message: r.error };
}
