"use server";

import { type ImportPreview, type ImportResult, UPLOAD_MAX_BYTES } from "@passport/core";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentAdmin } from "@/lib/auth";
import { runAdminJob } from "@/lib/queue";
import { readUpload } from "@/lib/xlsx";

export type PreviewState = { ok: true; preview: ImportPreview } | { ok: false; message: string };
export type ApplyState = { ok: boolean; message: string; added?: string[] };
type Texts = Awaited<ReturnType<typeof getDict>>["admin"]["upload"];

async function gridFrom(form: FormData, t: Texts): Promise<{ grid: string[][]; name: string } | string> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return t.chooseFile;
  if (!file.name.toLowerCase().endsWith(".xlsx")) return t.onlyXlsx;
  if (file.size > UPLOAD_MAX_BYTES) return t.tooBig;
  try {
    const grid = await readUpload(Buffer.from(await file.arrayBuffer()));
    return grid ? { grid, name: file.name } : t.noHeader;
  } catch {
    return t.unreadable;
  }
}

// server actions are public endpoints, so each one checks the admin itself
export async function previewUpload(form: FormData): Promise<PreviewState> {
  const d = await getDict();
  const t = d.admin.upload;
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: d.admin.actions.onlyAdmins };
  const read = await gridFrom(form, t);
  if (typeof read === "string") return { ok: false, message: read };
  const outcome = await runAdminJob<ImportPreview>({ kind: "import-preview", grid: read.grid, by: admin.email }, 15000);
  if (outcome.state === "failed") return { ok: false, message: fill(t.checkFailed, { error: outcome.error }) };
  if (outcome.state === "waiting") return { ok: false, message: t.noAnswer };
  return outcome.result.error ? { ok: false, message: outcome.result.error } : { ok: true, preview: outcome.result };
}

export async function applyUpload(form: FormData): Promise<ApplyState> {
  const d = await getDict();
  const t = d.admin.upload;
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: d.admin.actions.onlyAdmins };
  const read = await gridFrom(form, t);
  if (typeof read === "string") return { ok: false, message: read };
  const outcome = await runAdminJob<ImportResult>({ kind: "import-apply", grid: read.grid, fileName: read.name, by: admin.email }, 20000);
  if (outcome.state === "failed") return { ok: false, message: fill(t.nothingAdded, { error: outcome.error }) };
  if (outcome.state === "waiting") return { ok: true, message: t.stillAdding };
  const r = outcome.result;
  const n = r.added.length;
  return {
    ok: true, added: r.added,
    message: fill(t.added, { n, rows: n === 1 ? d.admin.rowOne : d.admin.rowMany })
      + (r.skipped ? fill(t.skipped, { n: r.skipped }) : "") + (r.queued ? t.issuing : ""),
  };
}
