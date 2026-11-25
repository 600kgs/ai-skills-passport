import Link from "next/link";
import { type ActivityFilters, activityFilters, queryString } from "@passport/core";
import { formatDateTime } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { activityPage, loggedVersion } from "@/lib/admin";
import { requireRole } from "../guard";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";
const field = "h-12 min-w-0 border-2 border-line bg-white px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";

// the list keeps its state in the url
const href = (f: ActivityFilters, change: Partial<ActivityFilters>) => {
  const n = { ...f, ...change };
  return `/admin/activity${queryString({ type: n.type, q: n.q, before: n.before })}`;
};

export default async function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireRole("viewer");
  const f = activityFilters(await searchParams);
  const [d, { audit, olderAudit, passportIds }] = await Promise.all([getDict(), activityPage(f)]);
  const t = d.admin.activity;
  const actions = t.actions as Record<string, string>;

  // a passport opens its page; a record shows its own history here
  const subject = (s: string) => passportIds.has(s)
    ? <Link href={`/admin/passports/${s}`} className={`text-ink ${link}`}>{s}</Link>
    : /^REC-\d+$/.test(s) ? <Link href={href(f, { q: s, before: null })} className={`text-ink ${link}`}>{s}</Link> : s;

  return (
    <div className="mt-10 max-w-3xl">
      <section aria-labelledby="audit-h">
        <h2 id="audit-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.auditTitle}</h2>
        <p className="mt-3 text-sm text-muted">{t.auditNote}</p>
        <form action="/admin/activity" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-display text-xl text-ink">{t.show}</span>
            <select name="type" defaultValue={f.type} className={field}>
              <option value="">{t.types.all}</option>
              <option value="records">{t.types.records}</option>
              <option value="issued">{t.types.issued}</option>
              <option value="staff">{t.types.staff}</option>
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

    </div>
  );
}
