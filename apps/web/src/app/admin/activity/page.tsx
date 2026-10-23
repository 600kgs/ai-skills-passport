import { Suspense } from "react";
import { activity } from "@/lib/admin";
import { dateTime } from "../format";
import { requireAdmin } from "../guard";

const ACTIONS: Record<string, string> = {
  passport_created: "Created passport",
  award_recorded: "Recorded skill",
  award_updated: "Record changed in the sheet",
  version_issued: "Issued version",
  record_confirmed: "Confirmed",
  record_rejected: "Rejected",
  sync_requested: "Started a sync",
  rows_imported: "Added rows from Excel file",
  ledger_reset: "Reset the ledger for a full reissue",
};

export default function AdminActivityPage() {
  return (
    <main>
      <Suspense fallback={<p className="mt-10 text-muted">Loading...</p>}>
        <Activity />
      </Suspense>
    </main>
  );
}

async function Activity() {
  await requireAdmin();
  const { runs, audit } = await activity();

  return (
    <div className="mt-10 grid gap-14 lg:grid-cols-2">
      <section aria-labelledby="audit-h">
        <h1 id="audit-h" className="border-b-2 border-foreground pb-2 text-2xl font-black">Who did what</h1>
        <p className="mt-3 text-sm text-muted">The latest 60 entries. &quot;system&quot; is the worker acting on the sheet.</p>
        <ol className="mt-2">
          {audit.map((a) => (
            <li key={a.id} className="border-b border-line py-3">
              <p>
                <b className="font-black">{ACTIONS[a.action] ?? a.action}</b>
                {a.subject && <> {a.subject}</>}
              </p>
              <p className="text-sm text-muted">{dateTime(a.at)}, {a.actor}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="runs-h">
        <h2 id="runs-h" className="border-b-2 border-foreground pb-2 text-2xl font-black">Syncs that changed something</h2>
        <p className="mt-3 text-sm text-muted">Quiet checks of the sheet aren&apos;t listed. A sync an admin starts always is.</p>
        <ol className="mt-2">
          {runs.map((r) => (
            <li key={r.id} className="border-b border-line py-3">
              {r.error ? (
                <p className="border-l-4 border-btu-red pl-3"><b className="font-black">Failed:</b> {r.error}</p>
              ) : (
                <p>
                  <b className="font-black">{r.newRecords ?? 0} new</b>
                  {(r.failedRecords ?? 0) > 0 && <>, <span className="text-btu-red">{r.failedRecords} rows to fix</span></>}
                </p>
              )}
              <p className="text-sm text-muted">{dateTime(r.finishedAt ?? r.startedAt)}, {r.trigger === "manual" ? "started by an admin" : "automatic"}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
