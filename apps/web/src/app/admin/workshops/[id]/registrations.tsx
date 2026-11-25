"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import { fill } from "@/i18n/format";
import type { ActionResult } from "../../actions";
import { makeRecords, markPassed, uploadRegistrations } from "./actions";

export type RegistrationView = {
  id: number; email: string; firstName: string; lastName: string; studentId: string; passed: boolean; recordId: string | null;
  match: "existing" | "new" | "problem"; notes: string[]; errors: string[]; hasSkill: boolean; storedName: string | null;
};

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `mt-3 max-w-prose border-l-8 bg-white p-3 text-sm ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

export function Registrations({ workshopId, rows, canEdit, hasSkill }: { workshopId: number; rows: RegistrationView[]; canEdit: boolean; hasSkill: boolean }) {
  const d = useDict();
  const t = d.admin.registrations;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) => start(async () => {
    setResult(null);
    setResult(await action().catch(() => ({ ok: false, message: d.admin.actions.network })));
    router.refresh();
  });
  const waiting = rows.filter((r) => r.passed && !r.recordId && r.match !== "problem").length;
  const matchLabel = { existing: t.existing, new: t.newStudent, problem: t.problem };

  return (
    <div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-4 border-2 border-dashed border-[#bdbdbd] bg-panel p-4">
          <label htmlFor="reg-file" className={`bg-magenta px-4 pt-2 pb-1.5 font-display text-xl text-white hover:bg-magenta-deep ${pending ? "opacity-60" : "cursor-pointer"}`}>
            {t.upload}
          </label>
          <input ref={input} id="reg-file" type="file" accept=".xlsx,.csv" disabled={pending} className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("file", f);
              run(() => uploadRegistrations(workshopId, fd));
              if (input.current) input.current.value = "";
            }} />
          <span className="max-w-prose text-sm text-muted">{t.uploadHint}</span>
        </div>
      )}
      <Result result={result} />

      {rows.length === 0 ? <p className="mt-6 text-muted">{t.empty}</p> : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b-2 border-blue">
                  {[t.passed, t.student, t.match, t.record].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-display text-xl font-normal text-blue">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-3 pr-4">
                      <input type="checkbox" checked={r.passed} disabled={!canEdit || pending || !!r.recordId || r.match === "problem"}
                        aria-label={fill(t.passedLabel, { name: `${r.firstName} ${r.lastName}` })}
                        onChange={(e) => run(() => markPassed(workshopId, [r.id], e.target.checked))} className="size-5 accent-magenta" />
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-ink">{r.storedName ?? `${r.firstName} ${r.lastName}`}</span>
                      <span className="block text-sm break-all text-muted">{r.email}{r.studentId ? `, ${r.studentId}` : ""}</span>
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      <span className={r.match === "problem" ? "font-semibold text-magenta" : ""}>{matchLabel[r.match]}</span>
                      {r.hasSkill && <span className="block font-semibold text-ink">{t.hasSkill}</span>}
                      {r.notes.map((n) => <span key={n} className="block text-muted">{n}</span>)}
                      {r.errors.map((n) => <span key={n} className="block border-l-4 border-magenta pl-2">{n}</span>)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{r.recordId ? <Link href={`/admin/records/${r.recordId}`} className={link}>{r.recordId}</Link> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <button type="button" disabled={pending || !waiting || !hasSkill}
                onClick={() => { if (window.confirm(fill(t.confirmCreate, { n: waiting }))) run(() => makeRecords(workshopId)); }}
                className="bg-magenta px-6 pt-3 pb-2.5 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">
                {fill(t.create, { n: waiting })}
              </button>
              {!hasSkill && <span className="text-sm text-muted">{t.noSkill}</span>}
              <Link href={`/admin/records?workshop=${workshopId}`} className={link}>{t.seeRecords}</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
