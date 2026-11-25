import Link from "next/link";
import { listSkills } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../../guard";
import { WorkshopForm } from "../workshop-form";

export default async function NewWorkshopPage() {
  await requireRole("editor");
  const [d, skills] = await Promise.all([getDict(), listSkills(getDb(), { activeOnly: true })]);
  const t = d.admin.workshops;
  return (
    <section aria-labelledby="new-ws-h" className="mt-10 max-w-3xl">
      <Link href="/admin/workshops" className="underline decoration-magenta decoration-2 underline-offset-2">← {t.back}</Link>
      <h2 id="new-ws-h" className="mt-4 mb-6 font-display text-4xl text-ink">{t.addTitle}</h2>
      <WorkshopForm id={null} skills={skills.map((s) => ({ skillId: s.skillId, name: s.name }))} />
    </section>
  );
}
