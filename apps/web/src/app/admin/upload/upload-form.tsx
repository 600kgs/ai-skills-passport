"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { ImportPreview } from "@passport/core";
import { applyUpload, previewUpload, type ApplyState } from "./actions";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";
const rows = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;
const NO_SERVER = "Couldn't reach the server. Check your connection and try again.";

export function UploadForm() {
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
      const r = await previewUpload(formOf(f)).catch(() => ({ ok: false as const, message: NO_SERVER }));
      if (r.ok) setPreview(r.preview); else setError(r.message);
      setBusy(null);
    });
  }

  function add() {
    if (!file) return;
    setBusy("add");
    start(async () => {
      setApplied(await applyUpload(formOf(file)).catch(() => ({ ok: false, message: NO_SERVER })));
      setBusy(null);
    });
  }

  const good = preview?.rows.filter((r) => r.ok).length ?? 0;
  const bad = (preview?.rows.length ?? 0) - good;

  return (
    <div className="mt-10">
      <label htmlFor="upload" className="block font-black">Excel file (.xlsx, up to 1 MB)</label>
      <input
        ref={input}
        id="upload"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={pending}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f); }}
        className={`mt-2 block w-full max-w-xl border-2 border-foreground p-3 file:mr-4 file:border-0 file:bg-foreground file:px-4 file:py-2 file:font-bold file:text-background ${focus}`}
      />

      <div aria-live="polite">
        {busy === "check" && <p className="mt-4 text-muted">Checking {file?.name} against the sheet...</p>}
        {error && <p className="mt-4 max-w-prose border-l-4 border-btu-red pl-4">{error}</p>}
      </div>

      {preview && !applied?.ok && (
        <section aria-labelledby="check-h" className="mt-10">
          <h2 id="check-h" className="border-b-2 border-foreground pb-2 text-2xl font-black">
            {good ? `${rows(good)} can be added` : "None of the rows can be added"}
            {bad > 0 && <span className="text-btu-red">, {rows(bad)} can&apos;t</span>}
          </h2>
          {preview.ignoredColumns.length > 0 && (
            <p className="mt-3 text-muted">Columns the sheet doesn&apos;t have, left out: {preview.ignoredColumns.join(", ")}.</p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-foreground">
                  <th scope="col" className="py-2 pr-4 font-black">Line</th>
                  <th scope="col" className="py-2 pr-4 font-black">Record</th>
                  <th scope="col" className="py-2 font-black">Check</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-b border-line align-top">
                    <td className="py-2 pr-4">{r.line}</td>
                    <td className="py-2 pr-4 font-bold whitespace-nowrap">{r.recordId || "no Record ID"}</td>
                    <td className="py-2">
                      {r.ok ? "Will be added" : <span className="block border-l-4 border-btu-red pl-3">{r.errors.join("; ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bad > 0 && good > 0 && (
            <p className="mt-4 max-w-prose text-muted">Rows that can&apos;t be added are skipped. Fix them in the file and upload it again later; rows already added will then show as duplicates.</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {good > 0 && (
              <button type="button" onClick={add} disabled={pending} className={`bg-btu-orange px-6 py-3 text-lg font-black disabled:opacity-60 ${focus}`}>
                {busy === "add" ? "Adding..." : `Add ${rows(good)} to the sheet`}
              </button>
            )}
            <button type="button" onClick={reset} disabled={pending} className={`font-bold underline disabled:opacity-60 ${focus}`}>
              Choose another file
            </button>
          </div>
        </section>
      )}

      {applied && (
        <div aria-live="polite" className={`mt-8 max-w-prose border-l-4 pl-4 ${applied.ok ? "border-btu-navy" : "border-btu-red"}`}>
          <p className="text-lg">{applied.message}</p>
          {applied.ok && (
            <p className="mt-2">
              <Link href="/admin" className="font-bold underline">Back to the overview</Link>{" "}
              <button type="button" onClick={reset} className={`ml-4 font-bold underline ${focus}`}>Upload another file</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
