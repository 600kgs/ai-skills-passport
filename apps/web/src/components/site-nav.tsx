"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav({ labels }: { labels: { verify: string; howItWorks: string; main: string } }) {
  const path = usePathname();
  const links = [
    { href: "/", label: labels.verify, current: path === "/" || path.startsWith("/v/") },
    { href: "/#how", label: labels.howItWorks, current: false },
  ];
  return (
    <nav aria-label={labels.main} className="ml-auto hidden sm:block">
      <ul className="flex gap-7">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={l.current ? "page" : undefined}
              className={`font-display text-2xl text-ink decoration-magenta decoration-4 underline-offset-[10px] hover:underline ${l.current ? "underline" : ""}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
