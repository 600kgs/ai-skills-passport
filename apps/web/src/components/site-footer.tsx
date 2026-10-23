import Link from "next/link";
import { getDict } from "@/i18n/server";

export async function SiteFooter() {
  const t = await getDict();
  const domain = new URL(process.env.PUBLIC_BASE_URL ?? "https://passport.btumarket.ge").host;
  const links = [
    { href: "/", label: t.footer.verifyPassport },
    { href: "/login", label: t.footer.studentSignIn },
    { href: "/privacy", label: t.footer.privacy },
  ];
  return (
    <footer className="mt-auto bg-footer text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_1.4fr]">
        <a href={t.site.universityUrl} className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static svg */}
          <img src="/btu-logo.svg" alt="" className="h-16 w-auto" />
          <span className="max-w-48 font-display text-xl text-white">{t.site.university}</span>
        </a>
        <ul className="space-y-2">
          {links.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white hover:underline">{l.label}</Link></li>)}
          <li><a href="/.well-known/btu-passport-issuer.json" className="hover:text-white hover:underline">{t.footer.issuerFile}</a></li>
        </ul>
        <p className="max-w-prose text-sm leading-relaxed sm:col-span-2 lg:col-span-1">
          {t.footer.note} <span className="font-semibold text-white">{domain}</span>
        </p>
      </div>
      <div className="bg-ink">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-white/55">© 2026 {t.footer.rights}</p>
      </div>
    </footer>
  );
}
