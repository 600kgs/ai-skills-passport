"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/passports", label: "Passports" },
  { href: "/admin/activity", label: "Activity" },
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-lg">
        {LINKS.map((l) => {
          const current = path === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground ${current ? "font-black underline decoration-btu-orange decoration-4 underline-offset-8" : "hover:underline"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
