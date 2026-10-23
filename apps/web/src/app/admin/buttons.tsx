"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideRecord, syncNow, type ActionResult } from "./actions";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) => start(async () => {
    setResult(null);
    setResult(await action().catch(() => ({ ok: false, message: "Couldn't reach the server. Check your connection and try again." })));
    router.refresh();
  });
  return { pending, result, run };
}

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `mt-3 border-l-4 pl-3 text-sm ${result.ok ? "border-btu-navy" : "border-btu-red"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

export function SyncButton() {
  const { pending, result, run } = useAction();
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => run(syncNow)} className={`border-2 border-foreground px-5 py-2 font-black disabled:opacity-60 ${focus}`}>
        {pending ? "Syncing..." : "Sync now"}
      </button>
      <Result result={result} />
    </div>
  );
}

export function DecisionButtons({ recordId, label }: { recordId: string; label: string }) {
  const { pending, result, run } = useAction();
  return (
    <div className="sm:text-right">
      <div className="flex gap-3 sm:justify-end">
        <button type="button" disabled={pending} onClick={() => run(() => decideRecord(recordId, "CONFIRMED"))}
          aria-label={`Confirm ${label}`} className={`bg-btu-orange px-5 py-2 font-black disabled:opacity-60 ${focus}`}>
          Confirm
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => decideRecord(recordId, "REJECTED"))}
          aria-label={`Reject ${label}`} className={`border-2 border-foreground px-5 py-2 font-bold disabled:opacity-60 ${focus}`}>
          Reject
        </button>
      </div>
      {pending && <p className="mt-3 text-sm text-muted">Writing to the sheet...</p>}
      <Result result={result} />
    </div>
  );
}
