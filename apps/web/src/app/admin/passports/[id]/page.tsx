import Link from "next/link";
import { notFound } from "next/navigation";
import { REMOVED_FROM_SHEET } from "@passport/core";
import { fill, formatDate, formatDateTime } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { loggedVersion, passportDetail } from "@/lib/admin";
import { requireAdmin } from "../../guard";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";
const th = "py-2 pr-4 font-display text-xl font-normal text-blue";

export default async function AdminPassportPage({ params }: PageProps<"/admin/passports/[id]">) {
  await requireAdmin();
  const [d, p] = await Promise.all([getDict(), passportDetail((await params).id)]);
  if (!p) notFound();
  const t = d.admin.passport;
  const actions = d.admin.activity.actions as Record<string, string>;
  const cluster = process.env.SOLANA_RPC_URL?.includes("devnet") ? "?cluster=devnet" : "";

  const recordStatus = (r: (typeof p.records)[number]) => {
    if (r.state !== "applied" && r.error === REMOVED_FROM_SHEET) return t.recordStates.removed;
    if (r.state === "applied") return fill(t.recordStates.applied, { n: r.appliedIn ?? "?" });
    if (r.state === "ignored") return r.verification === "REJECTED" ? t.recordStates.rejected : t.recordStates.awaiting;
    return t.recordStates[r.state];
  };

  return (
    <div className="mt-10">
      <Link href="/admin/passports" className={`text-ink ${link}`}>← {t.back}</Link>
      <h2 className="mt-4 font-display text-5xl text-ink">{p.student.firstName} {p.student.lastName}</h2>
      <p className="font-display text-3xl tracking-wider text-blue">{p.passport.passportId}</p>
      <dl className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [t.studentId, p.student.studentId],
          [t.email, p.student.email],
          [t.program, p.student.program],
          [t.level, p.student.educationLevel],
          [t.firstIssued, formatDate(d.locale, p.passport.firstIssued)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-words text-lg text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="versions-h" className="mt-12">
        <h3 id="versions-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.versionsTitle}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t.cols.version}</th>
                <th scope="col" className={th}>{t.cols.code}</th>
                <th scope="col" className={th}>{t.cols.state}</th>
                <th scope="col" className={th}>{t.cols.issued}</th>
                <th scope="col" className={th}>{t.cols.skills}</th>
                <th scope="col" className={th}>{t.cols.proof}</th>
                <th scope="col" className={th}><span className="sr-only">PDF</span></th>
              </tr>
            </thead>
            <tbody>
              {p.versions.map((v) => (
                <tr key={v.id} className="border-b border-line align-top">
                  <td className="py-3 pr-4 font-display text-2xl text-ink">
                    V{v.versionNo}
                    {v.id === p.passport.latestVersionId && <span className="ml-2 bg-yellow px-2 pt-0.5 font-display text-base text-ink">{t.latest}</span>}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {v.state === "issued" ? <Link href={`/v/${v.verificationCode}`} className={`font-semibold tracking-wider text-ink ${link}`}>{v.verificationCode}</Link> : <span className="tracking-wider text-muted">{v.verificationCode}</span>}
                  </td>
                  <td className={`py-3 pr-4 ${v.state === "failed" || v.revokedAt ? "font-semibold text-magenta" : "text-ink"}`}>
                    {v.revokedAt ? t.revoked : t.states[v.state]}
                    {v.revokedAt && <span className="block text-sm font-normal text-muted">{formatDateTime(d.locale, v.revokedAt)}: {v.revokeReason}</span>}
                    {v.error && <span className="block text-sm text-muted">{v.error}</span>}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{v.issuedAt && formatDateTime(d.locale, v.issuedAt)}</td>
                  <td className="py-3 pr-4">{v.skillCount}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {v.attestationAddress && v.state === "issued" && !v.revokedAt && <a href={`https://explorer.solana.com/address/${v.attestationAddress}${cluster}`} target="_blank" rel="noreferrer" className={`text-ink ${link}`}>{t.onChain}</a>}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {v.state === "issued" && <a href={`/api/pdf/${v.verificationCode}`} className="bg-magenta px-3 pt-1.5 pb-1 font-display text-lg text-white hover:bg-magenta-deep">PDF</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="records-h" className="mt-12">
        <h3 id="records-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.recordsTitle}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t.recCols.record}</th>
                <th scope="col" className={th}>{t.recCols.skill}</th>
                <th scope="col" className={th}>{t.recCols.category}</th>
                <th scope="col" className={th}>{t.recCols.status}</th>
              </tr>
            </thead>
            <tbody>
              {p.records.map((r) => (
                <tr key={r.recordId} className="border-b border-line align-top">
                  <td className="py-3 pr-4 font-semibold whitespace-nowrap text-ink">{r.recordId}</td>
                  <td className="py-3 pr-4 text-ink">{r.skillName}<span className="block text-sm text-muted">{formatDate(d.locale, r.dateEarned)}</span></td>
                  <td className="py-3 pr-4">{r.category}</td>
                  <td className={`py-3 ${r.state === "failed" || r.state === "conflict" ? "font-semibold text-magenta" : "text-ink"}`}>
                    {recordStatus(r)}
                    {r.error && <span className="block text-sm font-normal text-muted">{r.error === REMOVED_FROM_SHEET ? t.removedNote : r.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="history-h" className="mt-12">
        <h3 id="history-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.historyTitle}</h3>
        {p.history.length === 0 ? <p className="mt-4 text-muted">{t.noHistory}</p> : (
          <ol className="divide-y divide-line">
            {p.history.map((a) => (
              <li key={a.id} className="py-3">
                <p><b className="text-ink">{actions[a.action] ?? a.action}</b>{a.subject && <> {a.subject}</>}{loggedVersion(a.details)}</p>
                <p className="text-sm text-muted">{formatDateTime(d.locale, a.at)}, {a.actor}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
