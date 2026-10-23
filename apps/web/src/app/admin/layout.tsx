import type { Metadata } from "next";
import { getDict } from "@/i18n/server";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Admin | BTU AI Skills Digital Passport", robots: { index: false } };

// only the frame: every page checks the admin itself
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = (await getDict()).admin;
  return (
    <>
      <div className="bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-16 pb-0 sm:flex-row sm:items-end sm:justify-between sm:pt-20">
          <h1 className="pb-3 font-display text-5xl text-ink">{t.title}</h1>
          <AdminNav labels={t.tabs} label={t.title} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16">{children}</div>
    </>
  );
}
