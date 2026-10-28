import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { StickerCluster } from "@/components/sticker-cluster";
import { getDict } from "@/i18n/server";
import { currentUser } from "@/lib/auth";
import { publicStats } from "@/lib/stats";
import { VerifyForm } from "./verify-form";

export default async function HomePage() {
  const [t, user, stats] = await Promise.all([getDict(), currentUser(), publicStats()]);
  const h = t.home;

  return (
    <main>
      <section className="bg-blue text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-20 pb-16 sm:pt-28 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div>
            <h1 className="max-w-4xl font-display text-6xl sm:text-7xl lg:text-8xl">{h.title}</h1>
            <p className="mt-6 max-w-xl text-lg text-white/85">{h.lead}</p>
            <VerifyForm />
          </div>
          <StickerCluster className="hidden lg:block" />
        </div>
      </section>

      <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:py-24">
        <h2 id="how-h" className="font-display text-5xl text-magenta sm:text-6xl">{h.howTitle}</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {h.steps.map((s, i) => (
            <li key={s.title} className="border-t-4 border-blue pt-5">
              <span aria-hidden className="font-display text-7xl text-blue">{i + 1}</span>
              <h3 className="mt-2 font-display text-3xl text-ink">{s.title}</h3>
              <p className="mt-3 max-w-sm leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {stats && (
        <section aria-labelledby="stats-h" className="bg-panel">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 id="stats-h" className="sr-only">{h.statsTitle}</h2>
            <dl className="grid gap-8 sm:grid-cols-3">
              {([["passports", stats.passports], ["versions", stats.versions], ["skills", stats.skills]] as const).map(([k, n]) => (
                <div key={k} className="flex flex-col-reverse">
                  <dt className="mt-1 font-display text-2xl text-blue">{h.stats[k]}</dt>
                  <dd className="font-display text-7xl text-magenta"><CountUp to={n} /></dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section aria-labelledby="students-h" className="mx-auto grid max-w-6xl px-4 py-16 sm:py-24 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col items-start justify-between gap-8 bg-magenta p-8 text-white">
          <h2 id="students-h" className="font-display text-4xl">{h.studentsTitle}</h2>
          <Link href={user ? "/me" : "/login"} className="rounded-full border-2 border-white px-6 pt-2.5 pb-2 font-display text-xl hover:bg-white hover:text-magenta focus-visible:outline-white">
            {user ? h.openMine : h.signIn}
          </Link>
        </div>
        <p className="bg-panel p-8 text-lg leading-relaxed">{h.studentsText}</p>
      </section>
    </main>
  );
}
