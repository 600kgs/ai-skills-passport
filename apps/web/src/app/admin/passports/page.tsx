import Link from "next/link";
import { fill, formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { allPassports } from "@/lib/admin";
import { requireAdmin } from "../guard";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function AdminPassportsPage() {
  await requireAdmin();
  const [d, rows] = await Promise.all([getDict(), allPassports()]);
  const t = d.admin.passports;
  const cols = [t.cols.passport, t.cols.holder, t.cols.version, t.cols.code, t.cols.issued, t.cols.skills, ""];

  return (
    <section aria-labelledby="passports-h" className="mt-10">
      <h2 id="passports-h" className="font-display text-4xl text-ink">{fill(t.count, { n: rows.length })}</h2>
      <p className="mt-2 max-w-prose text-muted">{t.note}</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b-4 border-blue">
              {cols.map((h, i) => <th key={i} scope="col" className="py-2 pr-4 font-display text-xl font-normal text-blue">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.passportId} className="border-b border-line align-top">
                <td className="py-3 pr-4 font-semibold whitespace-nowrap text-ink">{p.passportId}</td>
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
    </section>
  );
}
