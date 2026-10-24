"use client";

import { useState } from "react";
import { useDict } from "@/i18n/client";

export function CopyLink({ url }: { url: string }) {
  const t = useDict().me;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // no clipboard access (old browser, insecure page): show the link so it can be copied by hand
      window.prompt(t.copyLink, url);
    }
  }

  return (
    <button type="button" onClick={copy} aria-live="polite"
      className="border-2 border-ink px-5 pt-2.5 pb-2 font-display text-xl text-ink hover:bg-ink hover:text-white">
      {copied ? t.copied : t.copyLink}
    </button>
  );
}
