import { fill, formatAgo, formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { overview, pendingRecords } from "@/lib/admin";
import { DecisionButtons, SyncButton } from "./buttons";
import { requireAdmin } from "./guard";

const LOW_BALANCE_ISSUES = 20;

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [d, o, pending] = await Promise.all([getDict(), overview(), pendingRecords()]);
  const t = d.admin.overview;
  const { counts, lastRun, issuer } = o;
  const ago = (x: Date) => formatAgo(d.locale, x);
  const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

  return (
    <>
      <section aria-labelledby="status-h" className="mt-10">
        <h2 id="status-h" className="sr-only">{t.status}</h2>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {([[t.passports, counts.passports], [t.students, counts.students], [t.versions, counts.issued], [t.inProgress, counts.in_progress]] as const).map(([label, n]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="mt-1 font-display text-xl text-blue">{label}</dt>
                <dd className="font-display text-6xl text-magenta">{n}</dd>
              </div>
            ))}
          </dl>
          <SyncButton />
        </div>
        <div className="mt-8 space-y-2 border-l-8 border-blue bg-panel p-5">
          {counts.failed > 0 && <p className="font-semibold text-ink">{fill(t.failed, { n: counts.failed })}</p>}
          <p>
            {!lastRun ? t.noSync
              : lastRun.error ? fill(t.syncFailed, { ago: ago(lastRun.finishedAt ?? lastRun.startedAt), error: lastRun.error })
              : <>{fill(lastRun.trigger === "manual" ? t.lastManual : t.lastChange, { ago: ago(lastRun.finishedAt ?? lastRun.startedAt) })} <span className="text-muted">{t.pollNote}</span></>}
          </p>
          {issuer && (
            <p className={issuer.issuesLeft !== null && issuer.issuesLeft < LOW_BALANCE_ISSUES ? "font-semibold text-magenta" : ""}>
              {issuer.balance === null ? t.keyUnknown
                : fill(t.key, { key: short(issuer.address), sol: issuer.balance.toFixed(3), n: issuer.issuesLeft ?? 0 })}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="pending-h" className="mt-14">
        <h2 id="pending-h" className="flex items-baseline gap-3 border-b-4 border-blue pb-2 font-display text-4xl text-ink">
          {t.pendingTitle} {pending.length > 0 && <span className="bg-magenta px-2 text-3xl text-white">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 max-w-prose text-muted">{t.pendingEmpty}</p>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-muted">{t.pendingHelp}</p>
            <ul className="mt-2 divide-y divide-line">
              {pending.map((r) => (
                <li key={r.recordId} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-lg"><b className="text-ink">{r.skillName}</b> <span className="text-muted">{r.category}</span></p>
                    <p className="mt-1 text-muted">
                      {r.firstName} {r.lastName}, {r.passportId ?? r.studentId}. {fill(t.earned, { date: formatDate(d.locale, r.dateEarned), rec: r.recordId })}
                    </p>
                  </div>
                  <DecisionButtons recordId={r.recordId} label={`${r.skillName}, ${r.firstName} ${r.lastName}`} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="problems-h" className="mt-14">
        <h2 id="problems-h" className="flex items-baseline gap-3 border-b-4 border-blue pb-2 font-display text-4xl text-ink">
          {t.problemsTitle} {o.problems.length > 0 && <span className="bg-ink px-2 text-3xl text-white">{o.problems.length}</span>}
        </h2>
        {o.problems.length === 0 ? (
          <p className="mt-4 text-muted">{t.problemsEmpty}</p>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-muted">{t.problemsHelp}</p>
            <ul className="mt-4 space-y-3">
              {o.problems.map((p) => (
                <li key={p.row} className="border-l-8 border-magenta bg-panel p-4">
                  <p className="font-display text-xl text-ink">{fill(t.row, { row: p.row })}{p.recordId && `, ${p.recordId}`}</p>
                  <p className="mt-1">{p.note}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
