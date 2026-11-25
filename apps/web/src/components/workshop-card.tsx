import { eventParts } from "@/i18n/format";
import type { Dict, Locale } from "@/i18n/dictionaries";

export type PublicWorkshop = {
  id: number; kind: string; title: string; titleEn: string | null; description: string; descriptionEn: string | null;
  trainer: string; startsAt: Date; endsAt: Date | null; location: string; registrationUrl: string;
  skillName: string | null; category: string | null;
};

// btu's own category stamps, the same art as on the pdf and the verify page
const STAMP: Record<string, string> = {
  "AI Skill": "/art/stamp-skill.png", "AI Applied Skill": "/art/stamp-applied.png", "AI Advanced Skill": "/art/stamp-advanced.png",
};

// a ticket: the date block on the left, the event on the right, the badge it earns stamped on top
export function WorkshopCard({ w, locale, t }: { w: PublicWorkshop; locale: Locale; t: Dict["workshops"] }) {
  const start = eventParts(locale, w.startsAt);
  const end = w.endsAt ? eventParts(locale, w.endsAt) : null;
  const title = (locale === "en" && w.titleEn) || w.title;
  const description = (locale === "en" && w.descriptionEn) || w.description;
  const sameDay = end && end.day === start.day && end.month === start.month;
  const stamp = w.category ? STAMP[w.category] : undefined;

  return (
    <article className="grid h-full grid-cols-[5.5rem_minmax(0,1fr)] border border-t-4 border-line border-t-blue bg-white sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="flex flex-col items-center bg-blue px-2 pt-4 pb-3 text-white">
        <span className="font-display text-6xl leading-none sm:text-7xl">{start.day}</span>
        <span className="mt-1 text-center font-display text-lg leading-tight">{start.month}</span>
        <span className="mt-auto pt-3 text-sm text-white/80">{start.time}{end && sameDay ? `–${end.time}` : ""}</span>
      </div>
      <div className="flow-root min-w-0 p-4 sm:p-5">
        {/* floated, so a long title wraps around the stamp instead of being squeezed beside it */}
        {stamp && (
          // eslint-disable-next-line @next/next/no-img-element -- small static png, nothing for the image optimizer to do
          <img src={stamp} alt="" className="pointer-events-none float-right mb-2 ml-2 w-16 -rotate-6 sm:ml-3 sm:w-28" />
        )}
        <p className="text-sm font-semibold text-magenta">{w.kind === "hackathon" ? t.hackathon : t.workshop}</p>
        <h3 className="mt-1 font-display text-3xl leading-tight break-words text-ink sm:text-4xl">{title}</h3>
        <p className="mt-2 max-w-prose leading-relaxed">{description}</p>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-muted">{t.place}</dt><dd className="break-words">{w.location}</dd>
          <dt className="text-muted">{t.trainer}</dt><dd className="break-words">{w.trainer}</dd>
          {end && !sameDay && <><dt className="text-muted">{t.until}</dt><dd>{end.day} {end.month}, {end.time}</dd></>}
          {w.skillName && <><dt className="text-muted">{t.badge}</dt><dd className="font-semibold text-ink">{w.skillName}</dd></>}
        </dl>
        <a href={w.registrationUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-block bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta">
          {t.register}<span className="sr-only"> ({t.newTab})</span>
        </a>
      </div>
    </article>
  );
}
