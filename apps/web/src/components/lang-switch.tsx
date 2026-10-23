"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { useDict } from "@/i18n/client";
import type { Locale } from "@/i18n/dictionaries";

export function LangSwitch() {
  const t = useDict();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: Locale) => start(async () => { await setLocale(l); router.refresh(); });

  return (
    <div role="group" aria-label={t.lang.label} className={`flex font-display text-lg ${pending ? "opacity-60" : ""}`}>
      {(["ka", "en"] as const).map((l, i) => (
        <span key={l} className="flex">
          {i > 0 && <span aria-hidden className="px-1.5 text-white/40">/</span>}
          <button type="button" lang={l} onClick={() => pick(l)} disabled={pending} aria-pressed={t.locale === l}
            aria-label={l === "ka" ? t.lang.kaFull : t.lang.enFull}
            className={t.locale === l ? "text-white underline decoration-magenta decoration-2 underline-offset-4" : "text-white/60 hover:text-white"}>
            {t.lang[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
