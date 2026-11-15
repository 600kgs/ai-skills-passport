"use client";

import { useState } from "react";
import { useDict } from "@/i18n/client";

export type SkillShare = { key: string; name: string; date: string; url: string };

// one linkedin button per skill. the "already added?" hint is only in this tab's memory: nothing is
// stored, so a shared lab computer keeps no trace of whose skills were opened
export function SkillLinkedIn({ skills }: { skills: SkillShare[] }) {
  const t = useDict().me;
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  return (
    <section aria-labelledby="skills-share-h" className="mt-8 bg-panel p-8">
      <h2 id="skills-share-h" className="font-display text-4xl text-ink">{t.skillsTitle}</h2>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed">{t.skillsText}</p>
      <ul className="mt-6">
        {skills.map((s) => (
          <li key={s.key} className="grid gap-3 border-t-2 border-line py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-display text-2xl text-ink">{s.name}</p>
              <p className="text-muted">{s.date}</p>
            </div>
            <div className="sm:text-right">
              <a href={s.url} target="_blank" rel="noreferrer"
                onClick={() => setOpened((prev) => new Set(prev).add(s.key))}
                className="inline-flex items-center gap-2.5 border-2 border-[#0a66c2] px-4 pt-2 pb-1.5 font-display text-lg text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white">
                <svg aria-hidden viewBox="0 0 24 24" className="mb-0.5 size-4 fill-current">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                </svg>
                {t.addSkillLinkedIn}
              </a>
              <p aria-live="polite" className="mt-2 text-sm text-muted">{opened.has(s.key) ? t.alreadyAdded : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
