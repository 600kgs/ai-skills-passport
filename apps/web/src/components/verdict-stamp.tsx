"use client";

// the result: the one loud element on the page. btu's tile colours with a fixed meaning,
// blue = genuine, yellow = genuine but replaced, black = no match; the words always say it too
import type { Outcome } from "@passport/core";
import { useDict } from "@/i18n/client";

type Kind = Outcome | "checking";

const TONE: Record<Kind, string> = {
  checking: "bg-panel text-ink",
  unknown: "bg-ink text-white",
  "record-only": "border-4 border-blue bg-white text-blue",
  "authentic-latest": "bg-blue text-white",
  "authentic-outdated": "bg-yellow text-ink",
  modified: "border-l-[12px] border-magenta bg-ink text-white",
};

const ICON: Record<Kind, React.ReactNode> = {
  checking: <circle cx="24" cy="24" r="16" strokeDasharray="6 6" />,
  unknown: <><circle cx="24" cy="24" r="19" /><path d="M18.5 19a5.5 5.5 0 1 1 7.5 5.1c-1.3.6-2 1.6-2 3V29M24 34v1" /></>,
  "record-only": <><path d="M14 6h14l8 8v28H14z" /><path d="M28 6v8h8M19 24h12M19 30h12" /></>,
  "authentic-latest": <><circle cx="24" cy="24" r="19" /><path d="m15 24.5 6.5 6.5L34 17.5" /></>,
  "authentic-outdated": <><circle cx="24" cy="24" r="19" /><path d="M24 13v12l7 4" /></>,
  modified: <><path d="M24 5 44 41H4z" /><path d="M24 18v11M24 34v1" /></>,
};

export function VerdictStamp({ outcome, extra }: { outcome: Kind; extra?: string }) {
  const s = useDict().verify.outcomes[outcome];
  return (
    <div role="status" aria-live="polite" className={`flex items-start gap-5 p-6 sm:p-8 ${TONE[outcome]}`}>
      <svg aria-hidden viewBox="0 0 48 48" className={`size-12 shrink-0 sm:size-16 ${outcome === "checking" ? "animate-spin [animation-duration:3s] motion-reduce:animate-none" : ""}`}
        fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {ICON[outcome]}
      </svg>
      <div>
        <p className="font-display text-5xl sm:text-6xl">{s.title}</p>
        <p className="mt-2 text-lg">{extra ?? s.detail}</p>
      </div>
    </div>
  );
}
