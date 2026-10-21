// the result as a passport-style stamp: the one loud element on the page
import type { Outcome } from "@passport/core";

const STAMPS: Record<Outcome | "checking", { title: string; detail: string; tone: string }> = {
  checking: { title: "CHECKING", detail: "Reading the record on Solana", tone: "border-muted text-muted" },
  unknown: { title: "UNKNOWN CODE", detail: "No BTU passport has this code", tone: "border-foreground text-foreground" },
  "record-only": { title: "OFFICIAL RECORD", detail: "Add the PDF to check the file itself", tone: "border-btu-navy text-btu-navy" },
  "authentic-latest": { title: "AUTHENTIC", detail: "Latest version of this passport", tone: "border-btu-navy bg-btu-navy text-white" },
  "authentic-outdated": { title: "AUTHENTIC, OUTDATED", detail: "A newer version has been issued", tone: "border-btu-orange bg-btu-orange text-foreground" },
  modified: { title: "MODIFIED", detail: "This file doesn't match what BTU issued", tone: "border-btu-red bg-btu-red text-white" },
};

export function VerdictStamp({ outcome, extra }: { outcome: Outcome | "checking"; extra?: string }) {
  const s = STAMPS[outcome];
  return (
    <div role="status" aria-live="polite" className={`inline-block -rotate-2 border-4 px-5 py-3 ${s.tone}`}>
      <p className="text-2xl font-black leading-tight sm:text-3xl">{s.title}</p>
      <p className="mt-1 text-sm font-bold">{extra ?? s.detail}</p>
    </div>
  );
}
