import { fill, formatDateTime } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { activity } from "@/lib/admin";
import { requireAdmin } from "../guard";

export default async function AdminActivityPage() {
  await requireAdmin();
  const [d, { runs, audit }] = await Promise.all([getDict(), activity()]);
  const t = d.admin.activity;
  const rows = (n: number) => (n === 1 ? d.admin.rowOne : d.admin.rowMany);

  return (
    <div className="mt-10 grid gap-14 lg:grid-cols-2">
      <section aria-labelledby="audit-h">
        <h2 id="audit-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.auditTitle}</h2>
        <p className="mt-3 text-sm text-muted">{t.auditNote}</p>
        <ol className="mt-2 divide-y divide-line">
          {audit.map((a) => (
            <li key={a.id} className="py-3">
              <p><b className="text-ink">{t.actions[a.action] ?? a.action}</b>{a.subject && <> {a.subject}</>}</p>
              <p className="text-sm text-muted">{formatDateTime(d.locale, a.at)}, {a.actor}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="runs-h">
        <h2 id="runs-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.runsTitle}</h2>
        <p className="mt-3 text-sm text-muted">{t.runsNote}</p>
        <ol className="mt-2 divide-y divide-line">
          {runs.map((r) => (
            <li key={r.id} className="py-3">
              {r.error ? (
                <p className="border-l-8 border-magenta pl-3"><b className="text-ink">{t.failed}</b> {r.error}</p>
              ) : (
                <p>
                  <b className="text-ink">{fill(t.newCount, { n: r.newRecords ?? 0 })}</b>
                  {(r.failedRecords ?? 0) > 0 && <>, <span className="font-semibold text-magenta">{fill(t.toFix, { n: r.failedRecords!, rows: rows(r.failedRecords!) })}</span></>}
                </p>
              )}
              <p className="text-sm text-muted">{formatDateTime(d.locale, r.finishedAt ?? r.startedAt)}, {r.trigger === "manual" ? t.byAdmin : t.automatic}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
