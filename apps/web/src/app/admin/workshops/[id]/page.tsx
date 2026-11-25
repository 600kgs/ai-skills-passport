import Link from "next/link";
import { notFound } from "next/navigation";
import { roleAtLeast, toTbilisi, type WorkshopStatus } from "@passport/core";
import { getWorkshop, listSkills, registrationsFor } from "@passport/ledger";
import { formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../../guard";
import { StatusButtons, WorkshopForm } from "../workshop-form";
import { Registrations } from "./registrations";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function WorkshopPage({ params }: PageProps<"/admin/workshops/[id]">) {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "editor");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = getDb();
  const [d, w, skills, regs] = await Promise.all([getDict(), getWorkshop(db, id), listSkills(db), registrationsFor(db, id)]);
  if (!w) notFound();
  const t = d.admin.workshops;

  return (
    <section aria-labelledby="ws-h" className="mt-10 max-w-4xl">
      <Link href="/admin/workshops" className={link}>← {t.back}</Link>
      <h2 id="ws-h" className="mt-4 font-display text-5xl text-ink">{w.title}</h2>
      <p className="mt-2 text-muted">{formatDate(d.locale, w.startsAt)}, {t.statuses[w.status as keyof typeof t.statuses]}</p>
      {canEdit && <div className="mt-6"><StatusButtons id={w.id} status={w.status as WorkshopStatus} /></div>}
      <div className="mt-12">
        <h3 className="border-b-4 border-blue pb-2 font-display text-3xl text-ink">{d.admin.registrations.title}</h3>
        <p className="mt-3 mb-4 max-w-prose text-muted">{d.admin.registrations.lead}</p>
        <Registrations workshopId={w.id} canEdit={canEdit} hasSkill={!!w.skillId} rows={regs.map((r) => ({
          id: r.id, email: r.email, firstName: r.firstName, lastName: r.lastName, studentId: r.studentId, passed: r.passed, recordId: r.recordId,
          match: r.match, notes: r.notes, errors: r.errors, hasSkill: r.hasSkill, storedName: r.storedName,
        }))} />
      </div>
      {canEdit && (
        <div className="mt-10">
          <h3 className="mb-4 border-b-4 border-blue pb-2 font-display text-3xl text-ink">{t.edit}</h3>
          <WorkshopForm id={w.id} skills={skills.map((s) => ({ skillId: s.skillId, name: s.name }))} initial={{
            kind: w.kind as "workshop" | "hackathon", title: w.title, titleEn: w.titleEn ?? "", description: w.description,
            descriptionEn: w.descriptionEn ?? "", trainer: w.trainer, startsAt: toTbilisi(w.startsAt),
            endsAt: w.endsAt ? toTbilisi(w.endsAt) : "", location: w.location, skillId: w.skillId ?? "", registrationUrl: w.registrationUrl,
          }} />
        </div>
      )}
    </section>
  );
}
