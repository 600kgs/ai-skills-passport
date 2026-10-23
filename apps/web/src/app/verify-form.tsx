"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeCode } from "@passport/core";
import { useDict } from "@/i18n/client";

export function VerifyForm() {
  const t = useDict().home;
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(input);
    if (!code) return setError(true);
    router.push(`/v/${code}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 max-w-2xl" noValidate>
      <label htmlFor="code" className="font-display text-2xl">{t.codeLabel}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="code"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          placeholder={t.codePlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error}
          aria-describedby={error ? "code-error" : "code-hint"}
          className="h-14 min-w-0 flex-1 bg-white px-4 text-xl uppercase tracking-wider text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta"
        />
        <button type="submit" className="h-14 bg-magenta px-8 pt-1 font-display text-3xl text-white hover:bg-magenta-deep focus-visible:outline-white">
          {t.verify}
        </button>
      </div>
      {error
        ? <p id="code-error" role="alert" className="mt-3 max-w-xl border-l-4 border-magenta bg-white/10 py-2 pl-3 pr-2">{t.codeError}</p>
        : <p id="code-hint" className="mt-3 text-white/75">{t.codeHint}</p>}
    </form>
  );
}
