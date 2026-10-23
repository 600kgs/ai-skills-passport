"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import { decideRecord, syncNow, type ActionResult } from "./actions";

function useAction() {
  const network = useDict().admin.actions.network;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) => start(async () => {
    setResult(null);
    setResult(await action().catch(() => ({ ok: false, message: network })));
    router.refresh();
  });
  return { pending, result, run };
}

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `mt-3 border-l-8 bg-white p-3 text-sm ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

export function SyncButton() {
  const t = useDict().admin.overview;
  const { pending, result, run } = useAction();
  return (
    <div className="max-w-xs">
      <button type="button" disabled={pending} onClick={() => run(syncNow)}
        className="border-2 border-ink bg-white px-5 pt-2.5 pb-2 font-display text-2xl text-ink hover:bg-ink hover:text-white disabled:opacity-60">
        {pending ? t.syncing : t.syncNow}
      </button>
      <Result result={result} />
    </div>
  );
}

export function DecisionButtons({ recordId, label }: { recordId: string; label: string }) {
  const t = useDict().admin.overview;
  const { pending, result, run } = useAction();
  return (
    <div className="sm:text-right">
      <div className="flex gap-3 sm:justify-end">
        <button type="button" disabled={pending} onClick={() => run(() => decideRecord(recordId, "CONFIRMED"))}
          aria-label={`${t.confirm}: ${label}`} className="bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">
          {t.confirm}
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => decideRecord(recordId, "REJECTED"))}
          aria-label={`${t.reject}: ${label}`} className="border-2 border-ink px-5 pt-2 pb-1.5 font-display text-2xl text-ink hover:bg-ink hover:text-white disabled:opacity-60">
          {t.reject}
        </button>
      </div>
      {pending && <p className="mt-3 text-sm text-muted">{t.writing}</p>}
      <Result result={result} />
    </div>
  );
}
