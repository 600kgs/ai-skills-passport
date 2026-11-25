"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import { fill } from "@/i18n/format";
import type { ActionResult } from "../../actions";
import { retry, revoke } from "./actions";

const small = "border-2 border-ink bg-white px-3 pt-1.5 pb-1 font-display text-lg text-ink hover:bg-ink hover:text-white disabled:opacity-60";

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `mt-2 max-w-xs border-l-8 bg-white p-2 text-sm whitespace-normal ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

// a superadmin's revoke: the reason (shown on the verify page) and which skills first added in this version were the mistake
export function RevokeVersion({ code, versionNo, newSkills }: { code: string; versionNo: number; newSkills: { recordId: string; name: string }[] }) {
  const d = useDict();
  const t = d.admin.revoke;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={small}>{t.revoke}</button>;
  return (
    <form className="w-72 space-y-3 border-2 border-magenta bg-white p-3 whitespace-normal" onSubmit={(e) => {
      e.preventDefault();
      if (!window.confirm(fill(t.confirm, { v: versionNo }))) return;
      start(async () => {
        setResult(null);
        setResult(await revoke(code, reason, picked).catch(() => ({ ok: false, message: d.admin.actions.network })));
        router.refresh();
      });
    }}>
      <label className="flex flex-col gap-1">
        <span className="font-display text-lg text-blue">{t.reason}</span>
        <textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="border-2 border-line px-2 py-1 text-base" />
        <span className="text-xs text-muted">{t.reasonHint}</span>
      </label>
      {newSkills.length > 0 && (
        <fieldset>
          <legend className="font-display text-lg text-blue">{t.mistake}</legend>
          {newSkills.map((s) => (
            <label key={s.recordId} className="mt-1 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={picked.includes(s.recordId)} className="mt-0.5 size-4 accent-magenta"
                onChange={(e) => setPicked(e.target.checked ? [...picked, s.recordId] : picked.filter((x) => x !== s.recordId))} />
              <span>{s.name} <span className="text-muted">({s.recordId})</span></span>
            </label>
          ))}
          <p className="mt-1 text-xs text-muted">{t.mistakeHint}</p>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-magenta px-3 pt-1.5 pb-1 font-display text-lg text-white hover:bg-magenta-deep disabled:opacity-60">{t.revoke}</button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={small}>{t.close}</button>
      </div>
      <Result result={result} />
    </form>
  );
}

export function RetryVersion({ passportId }: { passportId: string }) {
  const d = useDict();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} className={small} onClick={() => start(async () => {
        setResult(await retry(passportId).catch(() => ({ ok: false, message: d.admin.actions.network })));
        router.refresh();
      })}>{d.admin.revoke.retry}</button>
      <Result result={result} />
    </div>
  );
}
