"use client";

// placeholder verify page: proves the shared core package works in the browser.
// the real flow (chain lookup, pdf upload, four outcomes) replaces the result line.
import { useState } from "react";
import { normalizeCode } from "@passport/core";

export default function VerifyPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(input);
    setResult(code ? `Looking up ${code} is not connected yet.` : "That doesn't look like a verification code. It has 10 characters, like 7KQ4-M2XD-9P.");
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
          onChange={(e) => setInput(e.target.value)}
          placeholder="Verification code, e.g. 7KQ4-M2XD-9P"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 border-2 border-foreground px-4 py-3 text-lg uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus-visible:border-btu-orange"
        />
        <button type="submit" className="bg-btu-orange px-6 py-3 text-lg font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
          Verify passport
        </button>
      </form>

      {result && <p role="status" className="mt-6 border-l-4 border-btu-orange pl-4">{result}</p>}
    </main>
  );
}
