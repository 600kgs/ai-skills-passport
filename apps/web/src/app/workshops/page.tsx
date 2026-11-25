import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { upcomingPublic } from "@passport/ledger";
import { WorkshopCard } from "@/components/workshop-card";
import { getDict, getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Workshops | BTU AI Skills Digital Passport" };

async function List() {
  await connection();
  const [d, locale, list] = await Promise.all([getDict(), getLocale(), upcomingPublic(getDb())]);
  if (!list.length) return <p className="mt-8 max-w-prose text-lg text-muted">{d.workshops.empty}</p>;
  return (
    <ul className="mt-10 grid gap-8 lg:grid-cols-2">
      {list.map((w) => <li key={w.id}><WorkshopCard w={w} locale={locale} t={d.workshops} /></li>)}
    </ul>
  );
}

export default async function WorkshopsPage() {
  const t = (await getDict()).workshops;
  return (
    <main className="bg-panel">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-20">
        <h1 className="font-display text-6xl text-ink sm:text-7xl">{t.title}</h1>
        <p className="mt-4 max-w-prose text-lg">{t.lead}</p>
        <Suspense fallback={<p className="mt-8 text-muted">{t.loading}</p>}>
          <List />
        </Suspense>
      </div>
    </main>
  );
}
