import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Admin | BTU AI Skills Digital Passport", robots: { index: false } };

// only the frame: every page checks the admin itself
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-6 border-b-2 border-foreground pb-5 sm:flex-row sm:items-end sm:justify-between">
        <Link href="/admin" className="font-display text-4xl text-ink">Admin</Link>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
