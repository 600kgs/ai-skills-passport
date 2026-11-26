import Link from "next/link";
import { connection } from "next/server";
import { upcomingPublic } from "@passport/ledger";
import { getDict, getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { WorkshopCard } from "./workshop-card";
import { WorkshopCarousel } from "./workshop-carousel";

// the home page's next few workshops. "now" is per request, so it waits for one before reading the clock;
// a database hiccup hides the section instead of breaking the home page
export async function UpcomingWorkshops() {
  await connection();
  const [d, locale, upcoming] = await Promise.all([getDict(), getLocale(), upcomingPublic(getDb(), new Date(), 10).catch(() => [])]);
  if (!upcoming.length) return null;
  const t = d.workshops;
  return (
    <section aria-labelledby="workshops-h">
      {/* no bottom padding: the student box below brings its own, so the gap isn't doubled */}
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="workshops-h" className="font-display text-5xl text-magenta sm:text-6xl">{t.homeTitle}</h2>
          <Link href="/workshops" className="font-display text-2xl text-ink underline decoration-magenta decoration-4 underline-offset-8 hover:text-magenta">{t.all}</Link>
        </div>
        <p className="mt-4 max-w-prose text-lg">{t.lead}</p>
        <div className="mt-8">
          <WorkshopCarousel labels={{ prev: t.prev, next: t.next, region: t.homeTitle }}>
            {upcoming.map((w) => <WorkshopCard key={w.id} w={w} locale={locale} t={t} />)}
          </WorkshopCarousel>
        </div>
      </div>
    </section>
  );
}
