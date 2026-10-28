import Link from "next/link";
import { type ActivityFilters, activityFilters, queryString } from "@passport/core";
import { fill, formatDateTime } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { activityPage, loggedVersion } from "@/lib/admin";
import { requireAdmin } from "../guard";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";
const field = "h-12 min-w-0 border-2 border-line bg-white px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";

// both lists keep their state in the url; paging one keeps the other where it was
const href = (f: ActivityFilters, change: Partial<ActivityFilters>) => {
  const n = { ...f, ...change };
  return `/admin/activity${queryString({ type: n.type, q: n.q, before: n.before, runsBefore: n.runsBefore, problems: n.problemsOnly })}`;
};

export default async function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin();
  const f = activityFilters(await searchParams);
  const [d, { audit, olderAudit, runs, olderRuns, passportIds }] = await Promise.all([getDict(), activityPage(f)]);
  const t = d.admin.activity;
  const actions = t.actions as Record<string, string>;
  const rows = (n: number) => (n === 1 ? d.admin.rowOne : d.admin.rowMany);

  // a passport opens its page; a record shows its own history here
  const subject = (s: string) => passportIds.has(s)
    ? <Link href={`/admin/passports/${s}`} className={`text-ink ${link}`}>{s}</Link>
    : /^REC-\d+$/.test(s) ? <Link href={href(f, { q: s, before: null })} className={`text-ink ${link}`}>{s}</Link> : s;

  return (
    <div className="mt-10 grid gap-14 lg:grid-cols-2">
      <section aria-labelledby="audit-h">
        <h2 id="audit-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.auditTitle}</h2>
        <p className="mt-3 text-sm text-muted">{t.auditNote}</p>
        <form action="/admin/activity" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          {f.problemsOnly && <input type="hidden" name="problems" value="1" />}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-display text-xl text-ink">{t.show}</span>
            <select name="type" defaultValue={f.type} className={field}>
              <option value="">{t.types.all}</option>
              <option value="admin">{t.types.admin}</option>
              <option value="issued">{t.types.issued}</option>
              <option value="sheet">{t.types.sheet}</option>
              <option value="email">{t.types.email}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display text-xl text-ink">{t.search}</span>
            <input type="search" name="q" defaultValue={f.q} placeholder={t.searchId} className={field} />
          </label>
          <button type="submit" className="h-12 self-end bg-magenta px-5 pt-1 font-display text-2xl text-white hover:bg-magenta-deep">{t.search}</button>
        </form>
        {(f.type || f.q) && <p className="mt-3"><Link href={href(f, { type: "", q: "", before: null })} className={`text-ink ${link}`}>{t.clear}</Link></p>}

        {audit.length === 0 ? <p className="mt-6 text-muted">{t.none}</p> : (
          <ol className="mt-2 divide-y divide-line">
            {audit.map((a) => (
              <li key={a.id} className="py-3">
                <p><b className="text-ink">{actions[a.action] ?? a.action}</b>{a.subject && <> {subject(a.subject)}</>}{loggedVersion(a.details)}</p>
                <p className="text-sm text-muted">{formatDateTime(d.locale, a.at)}, {a.actor}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex justify-between gap-4">
          {f.before ? <Link href={href(f, { before: null })} className={`text-ink ${link}`}>{t.newer}</Link> : <span />}
          {olderAudit && <Link href={href(f, { before: olderAudit })} className={`font-display text-2xl text-ink ${link}`}>{t.older} →</Link>}
        </div>
      </section>

      <section aria-labelledby="runs-h">
        <h2 id="runs-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.runsTitle}</h2>
        <p className="mt-3 text-sm text-muted">{t.runsNote}</p>
        <ul className="mt-4 flex gap-1" aria-label={t.show}>
          {[[false, t.allRuns], [true, t.problemsOnly]].map(([on, label]) => (
            <li key={String(on)}>
              <Link href={href(f, { problemsOnly: on as boolean, runsBefore: null })} aria-current={f.problemsOnly === on ? "true" : undefined}
                className={`block px-4 pt-2 pb-1.5 font-display text-xl ${f.problemsOnly === on ? "bg-blue text-white" : "bg-panel text-ink hover:bg-line"}`}>
                {label as string}
              </Link>
            </li>
          ))}
        </ul>

        {runs.length === 0 ? <p className="mt-6 text-muted">{t.none}</p> : (
          <ol className="mt-2 divide-y divide-line">
            {runs.map((r) => (
              <li key={r.id} className="py-3">
                {r.error ? (
                  <p className="border-l-8 border-magenta pl-3"><b className="text-ink">{t.failed}</b> {r.error}</p>
                ) : (
                  <p>
                    {/* runs are saved only when something changed, so a run with nothing new still updated the sheet */}
                    <b className="text-ink">{r.newRecords ? fill(t.newCount, { n: r.newRecords }) : r.trigger === "manual" ? t.nothingNew : t.sheetUpdated}</b>
                    {(r.failedRecords ?? 0) > 0 && <>, <span className="font-semibold text-magenta">{fill(t.toFix, { n: r.failedRecords!, rows: rows(r.failedRecords!) })}</span></>}
                  </p>
                )}
                <p className="text-sm text-muted">{formatDateTime(d.locale, r.finishedAt ?? r.startedAt)}, {r.trigger === "manual" ? t.byAdmin : t.automatic}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex justify-between gap-4">
          {f.runsBefore ? <Link href={href(f, { runsBefore: null })} className={`text-ink ${link}`}>{t.newer}</Link> : <span />}
          {olderRuns && <Link href={href(f, { runsBefore: olderRuns })} className={`font-display text-2xl text-ink ${link}`}>{t.older} →</Link>}
        </div>
      </section>
    </div>
  );
}
