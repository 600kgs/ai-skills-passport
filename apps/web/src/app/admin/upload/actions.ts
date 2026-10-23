"use server";

import { type ImportPreview, type ImportResult, UPLOAD_MAX_BYTES } from "@passport/core";
import { currentAdmin } from "@/lib/auth";
import { runAdminJob } from "@/lib/queue";
import { readUpload } from "@/lib/xlsx";

export type PreviewState = { ok: true; preview: ImportPreview } | { ok: false; message: string };
export type ApplyState = { ok: boolean; message: string; added?: string[] };

async function gridFrom(form: FormData): Promise<{ grid: string[][]; name: string } | string> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return "Choose an .xlsx file first.";
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "Only .xlsx files work. In Excel or Google Sheets, save or download the file as .xlsx.";
  if (file.size > UPLOAD_MAX_BYTES) return "The file is over 1 MB. Split it into smaller files.";
  try {
    const grid = await readUpload(Buffer.from(await file.arrayBuffer()));
    return grid ? { grid, name: file.name } : "No tab in this file has a header row with Student ID and Record ID. Start from the template.";
  } catch {
    return "This file couldn't be read as an Excel workbook. Open it in Excel and save it again as .xlsx.";
  }
}

// server actions are public endpoints, so each one checks the admin itself
export async function previewUpload(form: FormData): Promise<PreviewState> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Only admins can upload records." };
  const read = await gridFrom(form);
  if (typeof read === "string") return { ok: false, message: read };
  const outcome = await runAdminJob<ImportPreview>({ kind: "import-preview", grid: read.grid, by: admin.email }, 15000);
  if (outcome.state === "failed") return { ok: false, message: `The worker couldn't check the file: ${outcome.error}.` };
  if (outcome.state === "waiting") return { ok: false, message: "The worker didn't answer in time. Try again in a moment." };
  return outcome.result.error ? { ok: false, message: outcome.result.error } : { ok: true, preview: outcome.result };
}

export async function applyUpload(form: FormData): Promise<ApplyState> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Only admins can upload records." };
  const read = await gridFrom(form);
  if (typeof read === "string") return { ok: false, message: read };
  const outcome = await runAdminJob<ImportResult>({ kind: "import-apply", grid: read.grid, fileName: read.name, by: admin.email }, 20000);
  if (outcome.state === "failed") return { ok: false, message: `Nothing was added: ${outcome.error}.` };
  if (outcome.state === "waiting") return { ok: true, message: "Sent. The worker is still adding the rows; check the overview in a minute." };
  const r = outcome.result;
  return {
    ok: true, added: r.added,
    message: `Added ${r.added.length} ${r.added.length === 1 ? "row" : "rows"} to the sheet${r.skipped ? `, skipped ${r.skipped}` : ""}.`
      + (r.queued ? " Their passports are being issued now." : ""),
  };
}
