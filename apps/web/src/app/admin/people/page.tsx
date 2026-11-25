import { bootstrapEmails, ROLES } from "@passport/core";
import { listStaff } from "@passport/ledger";
import { getDict } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { requireRole } from "../guard";
import { AddStaff, StaffRow } from "./staff-forms";

export default async function AdminPeoplePage() {
  await requireRole("superadmin");
  const [d, staff] = await Promise.all([getDict(), listStaff(getDb())]);
  const t = d.admin.people;
  const fromConfig = bootstrapEmails(process.env.ADMIN_EMAILS);
  const others = staff.filter((s) => !fromConfig.includes(s.email));

  return (
    <section aria-labelledby="people-h" className="mt-10">
      <h2 id="people-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{t.title}</h2>
      <p className="mt-4 max-w-prose text-muted">{t.lead}</p>
      <dl className="mt-4 grid max-w-prose gap-1 text-sm">
        {ROLES.map((r) => (
          <div key={r}><dt className="inline font-semibold text-ink">{t.roles[r]}</dt>: <dd className="inline">{t.roleHelp[r]}</dd></div>
        ))}
      </dl>
      <AddStaff />
      <ul className="mt-8 divide-y divide-line">
        {fromConfig.map((email) => (
          <li key={email} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="font-semibold break-all text-ink">{email}</span>
            <span className="text-muted">{t.roles.superadmin}, {t.fromConfig}</span>
          </li>
        ))}
        {others.map((s) => (
          <li key={s.email} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="font-semibold break-all text-ink">{s.email}</span>
            <StaffRow email={s.email} role={s.role} />
          </li>
        ))}
      </ul>
      {others.length === 0 && <p className="mt-2 text-muted">{t.empty}</p>}
      <p className="mt-4 text-sm text-muted">{t.fromConfigHelp}</p>
    </section>
  );
}
