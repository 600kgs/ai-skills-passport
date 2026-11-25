import Link from "next/link";
import { connection } from "next/server";
import { upcomingPublic } from "@passport/ledger";
import { getDict, getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { WorkshopCard } from "./workshop-card";

// the home page's next few workshops. "now" is per request, so it waits for one before reading the clock;
// a database hiccup hides the section instead of breaking the home page
export async function UpcomingWorkshops() {
  await connection();
  const [d, locale, upcoming] = await Promise.all([getDict(), getLocale(), upcomingPublic(getDb(), new Date(), 3).catch(() => [])]);
  if (!upcoming.length) return null;
  const t = d.workshops;
  return (
    <section aria-labelledby="workshops-h">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="workshops-h" className="font-display text-5xl text-magenta sm:text-6xl">{t.homeTitle}</h2>
          <Link href="/workshops" className="font-display text-2xl text-ink underline decoration-magenta decoration-4 underline-offset-8 hover:text-magenta">{t.all}</Link>
        </div>
        <p className="mt-4 max-w-prose text-lg">{t.lead}</p>
        <ul className="mt-10 grid gap-8 lg:grid-cols-2">
          {upcoming.map((w) => <li key={w.id}><WorkshopCard w={w} locale={locale} t={t} /></li>)}
        </ul>
      </div>
    </section>
  );
}
