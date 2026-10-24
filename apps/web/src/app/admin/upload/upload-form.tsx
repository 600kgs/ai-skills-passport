"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { ImportPreview } from "@passport/core";
import { useDict } from "@/i18n/client";
import { fill } from "@/i18n/format";
import { applyUpload, previewUpload, type ApplyState } from "./actions";

const link = "font-semibold underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export function UploadForm() {
  const d = useDict();
  const t = d.admin.upload;
  const rows = (n: number) => (n === 1 ? d.admin.rowOne : d.admin.rowMany);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyState | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"check" | "add" | null>(null);

  const formOf = (f: File) => { const fd = new FormData(); fd.set("file", f); return fd; };

  function reset() {
    setFile(null); setPreview(null); setError(null); setApplied(null);
    if (input.current) input.current.value = "";
  }

  function check(f: File) {
    setFile(f); setPreview(null); setError(null); setApplied(null); setBusy("check");
    start(async () => {
      const r = await previewUpload(formOf(f)).catch(() => ({ ok: false as const, message: d.admin.actions.network }));
      if (r.ok) setPreview(r.preview); else setError(r.message);
      setBusy(null);
    });
  }

  function add() {
    if (!file) return;
    setBusy("add");
    start(async () => {
      setApplied(await applyUpload(formOf(file)).catch(() => ({ ok: false, message: d.admin.actions.network })));
      setBusy(null);
    });
  }

  const good = preview?.rows.filter((r) => r.ok).length ?? 0;
  const bad = (preview?.rows.length ?? 0) - good;

  return (
    <div className="mt-10">
      <label htmlFor="upload" className="block font-display text-2xl text-ink">{t.fileLabel}</label>
      {/* the browser's own picker text ("Choose file") can't be translated, so it's hidden behind ours */}
      <div className="mt-2 flex max-w-xl flex-wrap items-center gap-4 border-2 border-dashed border-[#bdbdbd] bg-panel p-4 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-magenta">
        <label htmlFor="upload" className={`bg-magenta px-4 pt-2 pb-1.5 font-display text-xl text-white hover:bg-magenta-deep ${pending ? "opacity-60" : "cursor-pointer"}`}>
          {t.chooseButton}
        </label>
        <span className="min-w-0 truncate text-muted">{file?.name ?? t.noFile}</span>
        <input
          ref={input}
          id="upload"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={pending}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f); }}
          className="sr-only"
        />
      </div>

      <div aria-live="polite">
        {busy === "check" && <p className="mt-4 text-muted">{fill(t.checking, { file: file?.name ?? "" })}</p>}
        {error && <p className="mt-4 max-w-prose border-l-8 border-magenta bg-panel p-4">{error}</p>}
      </div>

      {preview && !applied?.ok && (
        <section aria-labelledby="check-h" className="mt-10">
          <h3 id="check-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">
            {good ? fill(t.canAdd, { n: good, rows: rows(good) }) : t.noneCanAdd}
            {bad > 0 && <span className="text-magenta">{fill(t.cantAdd, { n: bad })}</span>}
          </h3>
          {preview.ignoredColumns.length > 0 && <p className="mt-3 text-muted">{fill(t.ignored, { cols: preview.ignoredColumns.join(", ") })}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-blue">
                  {[t.cols.line, t.cols.record, t.cols.check].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-display text-xl font-normal text-blue">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-b border-line align-top">
                    <td className="py-2 pr-4">{r.line}</td>
                    <td className="py-2 pr-4 font-semibold whitespace-nowrap text-ink">{r.recordId || t.noRecordId}</td>
                    <td className="py-2">
                      {r.ok ? <span className="font-semibold text-blue">{t.willAdd}</span> : <span className="block border-l-8 border-magenta pl-3">{r.errors.join("; ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bad > 0 && good > 0 && <p className="mt-4 max-w-prose text-muted">{t.skippedNote}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-5">
            {good > 0 && (
              <button type="button" onClick={add} disabled={pending} className="bg-magenta px-6 pt-3 pb-2.5 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">
                {busy === "add" ? t.adding : fill(t.add, { n: good, rows: rows(good) })}
              </button>
            )}
            <button type="button" onClick={reset} disabled={pending} className={`${link} disabled:opacity-60`}>{t.another}</button>
          </div>
        </section>
      )}

      {applied && (
        <div aria-live="polite" className={`mt-8 max-w-prose border-l-8 bg-panel p-5 ${applied.ok ? "border-blue" : "border-magenta"}`}>
          <p className="text-lg text-ink">{applied.message}</p>
          {applied.ok && (
            <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/admin" className={link}>{t.back}</Link>
              <button type="button" onClick={reset} className={link}>{t.uploadAnother}</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
