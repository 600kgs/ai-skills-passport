import Link from "next/link";
import { roleAtLeast } from "@passport/core";
import { listWorkshops } from "@passport/ledger";
import { formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../guard";

const TABS = ["upcoming", "past", "drafts"] as const;
type Tab = (typeof TABS)[number];
const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function AdminWorkshopsPage({ searchParams }: PageProps<"/admin/workshops">) {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "editor");
  const show = String((await searchParams).show ?? "");
  const tab: Tab = (TABS as readonly string[]).includes(show) ? (show as Tab) : "upcoming";
  const [d, list] = await Promise.all([getDict(), listWorkshops(getDb(), tab)]);
  const t = d.admin.workshops;

  return (
    <section aria-labelledby="ws-h" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-blue pb-2">
        <h2 id="ws-h" className="font-display text-4xl text-ink">{t.title}</h2>
        {canEdit && <Link href="/admin/workshops/new" className="bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep">{t.add}</Link>}
      </div>
      <p className="mt-4 max-w-prose text-muted">{t.lead}</p>
      <ul className="mt-6 flex gap-1">
        {TABS.map((k) => (
          <li key={k}>
            <Link href={k === "upcoming" ? "/admin/workshops" : `/admin/workshops?show=${k}`} aria-current={tab === k ? "page" : undefined}
              className={`block px-4 pt-2 pb-1.5 font-display text-xl ${tab === k ? "bg-blue text-white" : "bg-panel text-ink hover:bg-line"}`}>
              {t.tabs[k]}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 ? <p className="mt-6 text-muted">{t.empty}</p> : (
        <ul className="mt-4 divide-y divide-line">
          {list.map((w) => (
            <li key={w.id} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline sm:gap-4">
              <span className="text-muted">{formatDate(d.locale, w.startsAt)}</span>
              <span>
                <Link href={`/admin/workshops/${w.id}`} className={`font-semibold text-ink ${link}`}>{w.title}</Link>
                <span className="block text-sm text-muted">{w.skillName ?? t.noBadge}</span>
              </span>
              <span className={`justify-self-start px-2 text-sm ${w.status === "published" ? "bg-blue text-white" : w.status === "cancelled" ? "bg-ink text-white" : "bg-panel text-ink"}`}>
                {t.statuses[w.status as keyof typeof t.statuses]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
