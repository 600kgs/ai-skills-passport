"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// the server picks the links the signed-in role may open
export function AdminNav({ links, label }: { links: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {links.map((l) => {
          // a passport's own page still sits under the passports tab
          const current = path === l.href || (l.href !== "/admin" && path.startsWith(`${l.href}/`));
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
