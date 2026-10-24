import type { Metadata } from "next";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Privacy | BTU AI Skills Digital Passport" };

const CONTACT = "otaritomas.sepashvili.1@btu.edu.ge";

export default async function PrivacyPage() {
  const p = (await getDict()).privacy;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <h1 className="font-display text-5xl text-ink sm:text-7xl">{p.title}</h1>
      <p className="mt-4 text-lg text-muted">{p.updated}</p>

      <div className="mt-10 space-y-10 text-lg leading-relaxed">
        {p.sections.map((s) => (
          <Section key={s.title} title={s.title}>{s.text}</Section>
        ))}
        <Section title={p.contactTitle}>
          {p.contactBefore}{" "}
          <a className="font-semibold break-all text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta" href={`mailto:${CONTACT}`}>{CONTACT}</a>.{" "}
          {p.contactAfter}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b-4 border-blue pb-2 font-display text-3xl text-ink">{title}</h2>
      <p className="mt-4">{children}</p>
    </section>
  );
}
