import Link from "next/link";
import { queryString, RECORD_SOURCES, RECORD_STATES, type RecordFilters, recordFilters, roleAtLeast } from "@passport/core";
import { listRecords } from "@passport/ledger";
import { fill, formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../guard";
import { recordStatus } from "./status";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";
const field = "h-12 min-w-0 border-2 border-line bg-white px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";
const th = "py-2 pr-4 font-display text-xl font-normal text-blue";

const href = (f: RecordFilters, page: number) =>
  `/admin/records${queryString({ q: f.q, verification: f.verification, state: f.state, source: f.source, workshop: f.workshop, page: page > 1 ? page : null })}`;

export default async function AdminRecordsPage({ searchParams }: PageProps<"/admin/records">) {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "admin");
  const f = recordFilters(await searchParams);
  const [d, { rows, total, pages, page }] = await Promise.all([getDict(), listRecords(getDb(), f)]);
  const t = d.admin.records;
  const states = d.admin.passport.recordStates as Record<string, string>;

  return (
    <section aria-labelledby="records-h" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-blue pb-2">
        <h2 id="records-h" className="font-display text-4xl text-ink">{t.title}</h2>
        <div className="flex flex-wrap gap-3">
          <a href={`/api/admin/export${queryString({ kind: "records", q: f.q, verification: f.verification, state: f.state, source: f.source, workshop: f.workshop })}`}
            className="border-2 border-ink px-4 pt-2 pb-1.5 font-display text-xl text-ink hover:bg-ink hover:text-white">{t.download}</a>
          {canEdit && <Link href="/admin/records/new" className="bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep">{t.add}</Link>}
        </div>
      </div>

      <form method="get" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={f.q} placeholder={t.searchHint} aria-label={t.search} className={field} />
        <select name="verification" defaultValue={f.verification} aria-label={t.verification} className={field}>
          <option value="">{t.anyVerification}</option>
          {["PENDING", "CONFIRMED", "REJECTED"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select name="state" defaultValue={f.state} aria-label={t.state} className={field}>
          <option value="">{t.anyState}</option>
          {RECORD_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="source" defaultValue={f.source} aria-label={t.source} className={field}>
          <option value="">{t.anySource}</option>
          {RECORD_SOURCES.map((s) => <option key={s} value={s}>{t.sources[s]}</option>)}
        </select>
        <button type="submit" className="h-12 border-2 border-ink px-5 font-display text-xl text-ink hover:bg-ink hover:text-white">{t.filter}</button>
      </form>

      <p className="mt-4 text-muted">{fill(t.count, { n: total })}</p>
      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className={th}>{t.id}</th>
                <th scope="col" className={th}>{t.student}</th>
                <th scope="col" className={th}>{t.skill}</th>
                <th scope="col" className={th}>{t.dateEarned}</th>
                <th scope="col" className={th}>{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.recordId}>
                  <td className="py-3 pr-4 whitespace-nowrap"><Link href={`/admin/records/${r.recordId}`} className={`font-semibold text-ink ${link}`}>{r.recordId}</Link></td>
                  <td className="py-3 pr-4">{r.firstName} {r.lastName}<span className="block text-sm text-muted">{r.studentId}</span></td>
                  <td className="py-3 pr-4">{r.skillName}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatDate(d.locale, r.dateEarned)}</td>
                  <td className="py-3 pr-4">
                    {recordStatus(states, r)}
                    <span className="block text-sm text-muted">{t.sources[r.source as keyof typeof t.sources] ?? r.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={t.pages} className="mt-6 flex items-center gap-4">
          {page > 1 && <Link href={href(f, page - 1)} className={link}>← {t.prev}</Link>}
          <span className="text-muted">{fill(t.pageOf, { page, pages })}</span>
          {page < pages && <Link href={href(f, page + 1)} className={link}>{t.next} →</Link>}
        </nav>
      )}
    </section>
  );
}
