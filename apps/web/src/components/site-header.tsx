import Link from "next/link";
import { getDict } from "@/i18n/server";
import { currentUser } from "@/lib/auth";
import { LangSwitch } from "./lang-switch";
import { SiteNav } from "./site-nav";

// btu.edu.ge's header: a dark utility strip, a white bar, and the pink logo on a grey tile
// hanging over both. next to it the passport's own orange mark, as on the pdf
export async function SiteHeader() {
  const [t, user] = await Promise.all([getDict(), currentUser()]);
  return (
    <header>
      <a href="#content" className="sr-only z-50 bg-magenta px-4 py-2 font-bold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-2">
        {t.site.skipToContent}
      </a>
      <div className="bg-graphite text-white">
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-end gap-3 px-4 pl-28 sm:gap-5 sm:pl-40">
          <a href={t.site.universityUrl} className="mr-auto hidden font-display text-lg text-white/85 hover:text-white lg:block">
            {t.site.university}
          </a>
          <LangSwitch />
          {user?.isAdmin && <Link href="/admin" className="font-display text-lg hover:text-yellow">{t.nav.admin}</Link>}
          <Link href={user ? "/me" : "/login"} className="bg-magenta px-3 pt-1.5 pb-1 font-display text-lg leading-none text-white hover:bg-magenta-deep">
            {user ? t.nav.myPassport : t.nav.signIn}
          </Link>
        </div>
      </div>
      <div className="border-b border-line bg-white">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:h-20">
          <a href={t.site.universityUrl} aria-label={t.site.university}
            className="absolute -top-10 left-4 z-10 flex h-[7.5rem] w-24 items-center justify-center bg-[#cfcfcf] p-3 sm:h-[9.5rem] sm:w-32 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static svg, nothing for the image optimizer to do */}
            <img src="/btu-logo.svg" alt="BTU" className="h-full w-auto" />
          </a>
          <Link href="/" className="ml-24 bg-btu-orange px-2.5 pt-1.5 pb-1 font-display text-lg leading-[0.9] text-ink sm:ml-32 sm:px-3 sm:text-xl">
            <span className="block">AI Skills</span>
            <span className="block">Digital Passport</span>
          </Link>
          <SiteNav labels={{ verify: t.nav.verify, howItWorks: t.nav.howItWorks, main: t.nav.main }} />
        </div>
      </div>
    </header>
  );
}
