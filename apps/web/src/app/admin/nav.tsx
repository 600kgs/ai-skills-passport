"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Labels = { overview: string; passports: string; upload: string; activity: string };

export function AdminNav({ labels, label }: { labels: Labels; label: string }) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: labels.overview },
    { href: "/admin/passports", label: labels.passports },
    { href: "/admin/upload", label: labels.upload },
    { href: "/admin/activity", label: labels.activity },
  ];
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {links.map((l) => {
          const current = path === l.href;
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={current ? "page" : undefined}
                className={`block whitespace-nowrap px-4 pt-3 pb-2 font-display text-2xl ${current ? "bg-white text-magenta" : "text-ink hover:bg-white/60"}`}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
