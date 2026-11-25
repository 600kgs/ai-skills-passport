import Link from "next/link";
import { notFound } from "next/navigation";
import { roleAtLeast, toTbilisi, type WorkshopStatus } from "@passport/core";
import { getWorkshop, listSkills } from "@passport/ledger";
import { formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../../guard";
import { StatusButtons, WorkshopForm } from "../workshop-form";

const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function WorkshopPage({ params }: PageProps<"/admin/workshops/[id]">) {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "editor");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = getDb();
  const [d, w, skills] = await Promise.all([getDict(), getWorkshop(db, id), listSkills(db)]);
  if (!w) notFound();
  const t = d.admin.workshops;

  return (
    <section aria-labelledby="ws-h" className="mt-10 max-w-3xl">
      <Link href="/admin/workshops" className={link}>← {t.back}</Link>
      <h2 id="ws-h" className="mt-4 font-display text-5xl text-ink">{w.title}</h2>
      <p className="mt-2 text-muted">{formatDate(d.locale, w.startsAt)}, {t.statuses[w.status as keyof typeof t.statuses]}</p>
      {canEdit && <div className="mt-6"><StatusButtons id={w.id} status={w.status as WorkshopStatus} /></div>}
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
