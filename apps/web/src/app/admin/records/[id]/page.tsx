import Link from "next/link";
import { notFound } from "next/navigation";
import { roleAtLeast } from "@passport/core";
import { listSkills, recordDetail } from "@passport/ledger";
import { formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../../guard";
import { EditRecordForm, EditStudentForm } from "../forms";
import { recordStatus } from "../status";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function RecordPage({ params }: PageProps<"/admin/records/[id]">) {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "admin");
  const { id } = await params;
  const db = getDb();
  const [d, r, skills] = await Promise.all([getDict(), recordDetail(db, id), listSkills(db)]);
  if (!r) notFound();
  const t = d.admin.records;
  const states = d.admin.passport.recordStates as Record<string, string>;
  const a = r.award;
  const editable = canEdit && (a.state === "pending" || a.state === "ignored");
  const status = recordStatus(states, { verification: a.verification, state: a.state, versionNo: r.versionNo });

  return (
    <section aria-labelledby="rec-h" className="mt-10 max-w-3xl">
      <Link href="/admin/records" className={link}>← {t.back}</Link>
      <h2 id="rec-h" className="mt-4 font-display text-5xl text-ink">{a.recordId}</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <dt className="text-muted">{t.student}</dt>
        <dd>{r.student.firstName} {r.student.lastName}{r.passportId && <>, <Link href={`/admin/passports/${r.passportId}`} className={link}>{r.passportId}</Link></>}</dd>
        <dt className="text-muted">{t.skill}</dt><dd>{a.skillId}, {a.skillName}</dd>
        <dt className="text-muted">{t.dateEarned}</dt><dd>{formatDate(d.locale, a.dateEarned)}</dd>
        <dt className="text-muted">{t.status}</dt><dd>{status}</dd>
        <dt className="text-muted">{t.source}</dt><dd>{t.sources[a.source as keyof typeof t.sources] ?? a.source}{a.createdBy ? `, ${a.createdBy}` : ""}</dd>
        {a.decidedBy && <><dt className="text-muted">{t.decidedBy}</dt><dd>{a.decidedBy}</dd></>}
      </dl>

      {editable && (
        <div className="mt-10">
          <h3 className="border-b-4 border-blue pb-2 font-display text-3xl text-ink">{t.editRecord}</h3>
          <div className="mt-4">
            <EditRecordForm recordId={a.recordId} skills={skills.map((s) => ({ skillId: s.skillId, name: s.name }))}
              initial={{ skillId: a.skillId, dateEarned: a.dateEarned, earnedThrough: a.earnedThrough ?? "", verification: a.verification === "CONFIRMED" ? "CONFIRMED" : "PENDING" }} />
          </div>
        </div>
      )}
      {canEdit && !editable && <p className="mt-8 max-w-prose text-muted">{t.notEditable}</p>}

      {canEdit && (
        <div className="mt-12">
          <h3 className="border-b-4 border-blue pb-2 font-display text-3xl text-ink">{t.editStudent}</h3>
          <div className="mt-4">
            <EditStudentForm identityLocked={r.identityLocked} initial={{
              studentId: r.student.studentId, firstName: r.student.firstName, lastName: r.student.lastName, email: r.student.email,
              program: r.student.program, educationLevel: r.student.educationLevel, status: r.student.status,
            }} />
          </div>
        </div>
      )}
    </section>
  );
}
