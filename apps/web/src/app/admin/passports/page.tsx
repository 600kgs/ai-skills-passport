import Link from "next/link";
import { type PassportFilters, passportFilters, type PassportSort, queryString } from "@passport/core";
import { fill, formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { listPassports, passportFilterOptions } from "@/lib/admin";
import { requireAdmin } from "../guard";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";
const field = "h-12 min-w-0 border-2 border-line bg-white px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";

// the filters live in the url, so a filtered view is a link and the form works without javascript
const href = (f: PassportFilters, change: Partial<PassportFilters>) => {
  const n = { ...f, page: 1, ...change };
  return `/admin/passports${queryString({ q: n.q, program: n.program, level: n.level, updated: n.updated, sort: n.sort === "newest" ? "" : n.sort, page: n.page > 1 ? n.page : null })}`;
};

export default async function AdminPassportsPage({ searchParams }: PageProps<"/admin/passports">) {
  await requireAdmin();
  const f = passportFilters(await searchParams);
  const [d, { rows, total, pages }, options] = await Promise.all([getDict(), listPassports(f), passportFilterOptions()]);
  const t = d.admin.passports;
  const filtered = !!(f.q || f.program || f.level || f.updated);

  const sortable = (label: string, sort: PassportSort) => (
    <th scope="col" aria-sort={f.sort === sort ? (sort === "name" || sort === "id" ? "ascending" : "descending") : undefined} className="py-2 pr-4 font-normal">
      <Link href={href(f, { sort })} aria-label={fill(t.sortBy, { col: label })} className={`font-display text-xl ${f.sort === sort ? "text-magenta" : "text-blue hover:text-magenta"}`}>
        {label}{f.sort === sort && <span aria-hidden> ↓</span>}
      </Link>
    </th>
  );
  const plain = (label: string) => <th scope="col" className="py-2 pr-4 font-display text-xl font-normal text-blue">{label}</th>;

  return (
    <section aria-labelledby="passports-h" className="mt-10">
      <form action="/admin/passports" className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        {f.sort !== "newest" && <input type="hidden" name="sort" value={f.sort} />}
        <label className="flex flex-col gap-1">
          <span className="font-display text-xl text-ink">{t.search}</span>
          <input type="search" name="q" defaultValue={f.q} placeholder={t.searchPlaceholder} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-xl text-ink">{t.program}</span>
          <select name="program" defaultValue={f.program} className={field}>
            <option value="">{t.allPrograms}</option>
            {options.programs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-xl text-ink">{t.level}</span>
          <select name="level" defaultValue={f.level} className={field}>
            <option value="">{t.allLevels}</option>
            {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-xl text-ink">{t.versions}</span>
          <select name="updated" defaultValue={f.updated} className={field}>
            <option value="">{t.anyVersion}</option>
            <option value="yes">{t.updatedYes}</option>
            <option value="no">{t.updatedNo}</option>
          </select>
        </label>
        <button type="submit" className="h-12 self-end bg-magenta px-6 pt-1 font-display text-2xl text-white hover:bg-magenta-deep">{t.apply}</button>
      </form>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="passports-h" className="font-display text-4xl text-ink">{fill(t.count, { n: total })}</h2>
        {filtered && <Link href="/admin/passports" className={`text-ink ${link}`}>{t.clear}</Link>}
      </div>
      <p className="mt-2 max-w-prose text-muted">{t.note}</p>

      {rows.length === 0 ? (
        <p className="mt-6 border-l-8 border-blue bg-panel p-5 text-lg">{t.none}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead>
              <tr className="border-b-4 border-blue">
                {sortable(t.cols.passport, "id")}
                {sortable(t.cols.holder, "name")}
                {sortable(t.cols.version, "versions")}
                {plain(t.cols.code)}
                {sortable(t.cols.issued, "newest")}
                {plain(t.cols.skills)}
                {plain("")}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.passportId} className="border-b border-line align-top">
                  <td className="py-3 pr-4 whitespace-nowrap"><Link href={`/admin/passports/${p.passportId}`} className={`font-semibold text-ink ${link}`}>{p.passportId}</Link></td>
                  <td className="py-3 pr-4 text-ink">{p.firstName} {p.lastName}<span className="block text-sm text-muted">{p.email}</span></td>
                  {p.code ? (
                    <>
                      <td className="py-3 pr-4 font-display text-2xl text-ink">V{p.versionNo}</td>
                      <td className="py-3 pr-4 whitespace-nowrap"><Link href={`/v/${p.code}`} className={`font-semibold tracking-wider text-ink ${link}`}>{p.code}</Link></td>
                      <td className="py-3 pr-4 whitespace-nowrap">{p.issuedAt && formatDate(d.locale, p.issuedAt)}</td>
                      <td className="py-3 pr-4">{p.skillCount}</td>
                      <td className="py-3 whitespace-nowrap"><a href={`/api/pdf/${p.code}`} className="bg-magenta px-3 pt-1.5 pb-1 font-display text-lg text-white hover:bg-magenta-deep">PDF</a></td>
                    </>
                  ) : (
                    <td colSpan={5} className="py-3 text-muted">{fill(t.notIssued, { date: formatDate(d.locale, p.firstIssued) })}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t.pager} className="mt-6 flex items-center justify-between gap-4">
          {f.page > 1 ? <Link href={href(f, { page: f.page - 1 })} className={`font-display text-2xl text-ink ${link}`}>← {t.prev}</Link> : <span />}
          <p className="text-muted">{fill(t.pageOf, { page: Math.min(f.page, pages), pages })}</p>
          {f.page < pages ? <Link href={href(f, { page: f.page + 1 })} className={`font-display text-2xl text-ink ${link}`}>{t.next} →</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
