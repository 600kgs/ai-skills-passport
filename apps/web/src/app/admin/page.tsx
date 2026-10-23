import { Suspense } from "react";
import { overview, pendingRecords } from "@/lib/admin";
import { DecisionButtons, SyncButton } from "./buttons";
import { ago, day, plural } from "./format";
import { requireAdmin } from "./guard";

const LOW_BALANCE_ISSUES = 20;

export default function AdminOverviewPage() {
  return (
    <main>
      <Suspense fallback={<p className="mt-10 text-muted">Loading...</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}

async function Overview() {
  await requireAdmin();
  const [o, pending] = await Promise.all([overview(), pendingRecords()]);
  const { counts, lastRun, issuer } = o;

  return (
    <>
      <section aria-labelledby="status-h" className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <h1 id="status-h" className="sr-only">Status</h1>
        <div className="max-w-3xl space-y-3 text-xl leading-snug sm:text-2xl">
          <p>
            <b className="font-black">{plural(counts.passports, "passport")}</b> for {plural(counts.students, "student")},{" "}
            <b className="font-black">{plural(counts.issued, "version")}</b> issued on chain.
            {counts.in_progress > 0 && <> <b className="font-black text-btu-navy">{counts.in_progress}</b> being issued right now.</>}
          </p>
          {counts.failed > 0 && (
            <p className="border-l-4 border-btu-red pl-4 text-lg">
              {plural(counts.failed, "version")} failed to issue. The worker retries on its own; if it stays, check the worker log.
            </p>
          )}
          <p className="text-lg text-muted">
            {!lastRun ? "No sync has run yet."
              : lastRun.error ? <>Last sync failed {ago(lastRun.finishedAt ?? lastRun.startedAt)}: {lastRun.error}</>
              : <>Last change from the sheet {ago(lastRun.finishedAt ?? lastRun.startedAt)}. The worker checks the sheet every 15 seconds.</>}
          </p>
          {issuer && (
            <p className={`text-lg ${issuer.issuesLeft !== null && issuer.issuesLeft < LOW_BALANCE_ISSUES ? "border-l-4 border-btu-red pl-4" : "text-muted"}`}>
              {issuer.balance === null
                ? "Couldn't read the issuer wallet's balance from Solana."
                : <>The issuer wallet holds {issuer.balance.toFixed(3)} SOL, enough for about {issuer.issuesLeft} more issues.</>}
            </p>
          )}
        </div>
        <SyncButton />
      </section>

      <section aria-labelledby="pending-h" className="mt-14">
        <h2 id="pending-h" className="border-b-2 border-foreground pb-2 text-2xl font-black">
          Waiting for confirmation {pending.length > 0 && <span className="text-btu-orange">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 max-w-prose text-muted">
            Nothing is waiting. Records marked PENDING in the sheet, or with an empty Verification Status, show up here.
          </p>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-muted">
              Confirm a record and it goes into the student&apos;s passport as a new version. Reject it and it stays out. Either way the decision is written into the sheet.
            </p>
            <ul className="mt-2">
              {pending.map((r) => (
                <li key={r.recordId} className="grid gap-4 border-b border-line py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-lg"><b className="font-black">{r.skillName}</b> <span className="text-muted">{r.category}</span></p>
                    <p className="mt-1 text-muted">
                      {r.firstName} {r.lastName}, {r.passportId ?? r.studentId}. Earned {day(r.dateEarned)}. Record {r.recordId}
                    </p>
                  </div>
                  <DecisionButtons recordId={r.recordId} label={`${r.skillName} for ${r.firstName} ${r.lastName}`} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="problems-h" className="mt-14">
        <h2 id="problems-h" className="border-b-2 border-foreground pb-2 text-2xl font-black">
          Rows to fix in the sheet {o.problems.length > 0 && <span className="text-btu-red">{o.problems.length}</span>}
        </h2>
        {o.problems.length === 0 ? (
          <p className="mt-4 text-muted">Every row in the sheet synced.</p>
        ) : (
          <>
            <p className="mt-4 max-w-prose text-muted">
              These rows were left out and no passport changed because of them. Fix the row in the sheet; the next sync picks it up.
            </p>
            <ul className="mt-2">
              {o.problems.map((p) => (
                <li key={p.row} className="border-b border-line py-4">
                  <p className="font-black">Row {p.row}{p.recordId && `, ${p.recordId}`}</p>
                  <p className="mt-1 border-l-4 border-btu-red pl-3">{p.note}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
