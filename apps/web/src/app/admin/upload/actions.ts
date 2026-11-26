"use server";

import { parseRecordUpload, UPLOAD_MAX_BYTES } from "@passport/core";
import { checkRecords, createRecords } from "@passport/ledger";
import { auditLog } from "@passport/db";
import { fill } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { enqueueIssue } from "@/lib/queue";
import { readUpload } from "@/lib/xlsx";

export type PreviewRow = { line: number; label: string; ok: boolean; errors: string[] };
export type Preview = { rows: PreviewRow[]; ignoredColumns: string[] };
export type PreviewState = { ok: true; preview: Preview } | { ok: false; message: string };
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

// the file's own problems plus the ledger's, line by line; the same check runs again right before adding
async function check(grid: string[][]) {
  const parsed = parseRecordUpload(grid);
  if (parsed.error) return { error: parsed.error } as const;
  const ledger = await checkRecords(getDb(), parsed.rows.map((r) => r.item));
  const rows = parsed.rows.map((r, i) => {
    const errors = [...r.errors, ...(ledger[i]?.errors ?? [])];
    const s = r.item.student;
    return { line: r.line, label: `${s.firstName} ${s.lastName} (${s.studentId}), ${r.item.record.skillId}`, ok: !errors.length, errors, item: r.item };
  });
  return { rows, ignoredColumns: parsed.ignoredColumns } as const;
}

// server actions are public endpoints, so each one checks the role itself
export async function previewUpload(form: FormData): Promise<PreviewState> {
  const d = await getDict();
  if (!(await currentStaff("admin"))) return { ok: false, message: d.admin.actions.onlyAdmins };
  const read = await gridFrom(form, d.admin.upload);
  if (typeof read === "string") return { ok: false, message: read };
  const c = await check(read.grid);
  if ("error" in c) return { ok: false, message: c.error! };
  return { ok: true, preview: { rows: c.rows.map((r) => ({ line: r.line, label: r.label, ok: r.ok, errors: r.errors })), ignoredColumns: c.ignoredColumns } };
}

export async function applyUpload(form: FormData): Promise<ApplyState> {
  const d = await getDict();
  const t = d.admin.upload;
  const me = await currentStaff("admin");
  if (!me) return { ok: false, message: d.admin.actions.onlyAdmins };
  const read = await gridFrom(form, t);
  if (typeof read === "string") return { ok: false, message: read };
  const c = await check(read.grid);
  if ("error" in c) return { ok: false, message: fill(t.nothingAdded, { error: c.error! }) };
  const valid = c.rows.filter((r) => r.ok);
  if (!valid.length) return { ok: false, message: fill(t.nothingAdded, { error: t.noneCanAdd }) };
  const r = await createRecords(getDb(), valid.map((v) => v.item), { by: me.email, source: "excel" });
  const added = r.created.map((x) => x.recordId);
  await getDb().insert(auditLog).values({
    actor: me.email, action: "rows_imported", subject: read.name, details: { added, skipped: c.rows.length - added.length },
  });
  await enqueueIssue(r.queue);
  const n = added.length;
  const skipped = c.rows.length - n;
  return {
    ok: true, added,
    message: fill(t.added, { n, rows: n === 1 ? d.admin.rowOne : d.admin.rowMany }) + (skipped ? fill(t.skipped, { n: skipped }) : "") + (r.queue.length ? t.issuing : ""),
  };
}
