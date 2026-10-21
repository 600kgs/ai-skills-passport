"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeCode } from "@passport/core";

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(input);
    if (!code) return setError("A verification code has 10 characters, like 7KQ4-M2XD-9P. You'll find it next to the QR code on every page of the passport.");
    router.push(`/v/${code}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
      <h1 className="text-4xl leading-none sm:text-5xl">
        <span className="block font-black">AI SKILLS</span>
        <span className="block">DIGITAL PASSPORT</span>
      </h1>
      <p className="mt-6 max-w-prose text-muted">
        Check that a passport was issued by Business and Technology University and hasn&apos;t been changed. No account needed.
      </p>

      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="code" className="sr-only">Verification code</label>
        <input
          id="code"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          placeholder="Verification code, e.g. 7KQ4-M2XD-9P"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
          className="min-w-0 flex-1 border-2 border-foreground px-4 py-3 text-lg uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus-visible:border-btu-orange"
        />
        <button type="submit" className="bg-btu-orange px-6 py-3 text-lg font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
          Verify passport
        </button>
      </form>
      {error && <p id="code-error" className="mt-4 border-l-4 border-btu-red pl-4">{error}</p>}
    </main>
  );
}
