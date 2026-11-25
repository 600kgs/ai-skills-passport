import Link from "next/link";
import { listSkills } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../../guard";
import { NewRecordForm } from "../forms";

export default async function NewRecordPage() {
  await requireRole("admin");
  const [d, skills] = await Promise.all([getDict(), listSkills(getDb(), { activeOnly: true })]);
  const t = d.admin.records;
  return (
    <section aria-labelledby="new-h" className="mt-10 max-w-3xl">
      <Link href="/admin/records" className="underline decoration-magenta decoration-2 underline-offset-2">← {t.back}</Link>
      <h2 id="new-h" className="mt-4 font-display text-4xl text-ink">{t.addTitle}</h2>
      <NewRecordForm skills={skills.map((s) => ({ skillId: s.skillId, name: s.name }))} />
    </section>
  );
}
