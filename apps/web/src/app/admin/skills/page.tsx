import { roleAtLeast } from "@passport/core";
import { listSkills } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../guard";
import { SkillForm } from "./skill-form";

export default async function AdminSkillsPage() {
  const canEdit = roleAtLeast((await requireRole("viewer")).role, "admin");
  const [d, list] = await Promise.all([getDict(), listSkills(getDb())]);
  const t = d.admin.skills;

  return (
    <section aria-labelledby="skills-h" className="mt-10">
      <h2 id="skills-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.title}</h2>
      <p className="mt-4 max-w-prose text-muted">{t.lead}</p>
      {canEdit && (
        <details className="mt-6 border-2 border-line bg-white p-4">
          <summary className="cursor-pointer font-display text-2xl text-ink">{t.addTitle}</summary>
          <div className="mt-4"><SkillForm /></div>
        </details>
      )}
      {list.length === 0 ? <p className="mt-6 text-muted">{t.empty}</p> : (
        <ul className="mt-6 divide-y divide-line">
          {list.map((s) => (
            <li key={s.skillId} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-2xl text-blue">{s.skillId}</span>
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="text-muted">{s.category}</span>
                {!s.active && <span className="bg-ink px-2 text-sm text-white">{t.inactive}</span>}
              </div>
              <p className="mt-1 max-w-prose text-sm">{s.description}</p>
              {canEdit && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm underline decoration-magenta decoration-2 underline-offset-2">{t.edit}</summary>
                  <div className="mt-3">
                    <SkillForm initial={{ skillId: s.skillId, name: s.name, category: s.category, description: s.description, active: s.active }} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
