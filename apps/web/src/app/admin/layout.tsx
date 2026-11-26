import type { Metadata } from "next";
import { Suspense } from "react";
import { type Role, roleAtLeast } from "@passport/core";
import { getDict } from "@/i18n/server";
import { currentUser } from "@/lib/auth";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Admin | BTU AI Skills Digital Passport", robots: { index: false } };

type Tab = "overview" | "records" | "passports" | "workshops" | "skills" | "upload" | "activity" | "people";
// each tab with the lowest role that may open it; the pages check the role again themselves
const TABS: [Tab, string, Role][] = [
  ["overview", "/admin", "viewer"],
  ["records", "/admin/records", "viewer"],
  ["passports", "/admin/passports", "viewer"],
  ["workshops", "/admin/workshops", "viewer"],
  ["skills", "/admin/skills", "viewer"],
  ["upload", "/admin/upload", "admin"],
  ["activity", "/admin/activity", "viewer"],
  ["people", "/admin/people", "superadmin"],
];

async function RoleNav({ label, labels }: { label: string; labels: Record<Tab, string> }) {
  const role = (await currentUser())?.role ?? null;
  const links = TABS.filter(([, , min]) => roleAtLeast(role, min)).map(([k, href]) => ({ href, label: labels[k] }));
  return <AdminNav links={links} label={label} />;
}

// only the frame: every page checks the role itself
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = (await getDict()).admin;
  return (
    <>
      <div className="bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-16 pb-0 sm:pt-20">
          <h1 className="pb-3 font-display text-5xl text-ink">{t.title}</h1>
          <Suspense fallback={<AdminNav links={[]} label={t.title} />}>
            <RoleNav label={t.title} labels={t.tabs} />
          </Suspense>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16">{children}</div>
    </>
  );
}
