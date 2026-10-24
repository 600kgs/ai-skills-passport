import Link from "next/link";
import { redirect } from "next/navigation";
import { linkedInAddUrl, verifyUrl } from "@passport/core";
import { SignOutButton } from "@/components/auth-buttons";
import { CopyLink } from "@/components/copy-link";
import { formatDate } from "@/i18n/format";
import { getDict } from "@/i18n/server";
import { currentUser } from "@/lib/auth";
import { passportForEmail } from "@/lib/passports";

const link = "font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function MePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [t, passport] = await Promise.all([getDict(), passportForEmail(user.email)]);
  const m = t.me;
  const latest = passport?.versions.find((v) => v.isLatest);
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "https://passport.btumarket.ge";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
        <span>{m.signedInAs} <b className="text-ink">{user.email}</b></span>
        <SignOutButton />
        {user.isAdmin && <Link href="/admin" className={link}>{m.openAdmin}</Link>}
      </p>

      {!passport ? (
        <section className="mt-10 max-w-2xl border-t-8 border-magenta bg-panel p-8">
          <h1 className="font-display text-5xl text-ink">{m.noPassportTitle}</h1>
          <p className="mt-4 text-lg leading-relaxed">{m.noPassportText}</p>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <p className="font-display text-2xl text-blue">{m.passport} {passport.passportId}</p>
            <h1 className="font-display text-6xl text-ink sm:text-7xl">{passport.holder}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed">{m.share}</p>
          </section>

          <section aria-labelledby="versions-h" className="mt-14">
            <h2 id="versions-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{m.versions}</h2>
            <ul>
              {passport.versions.map((v) => (
                <li key={v.code} className={`mt-4 grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center ${v.isLatest ? "bg-blue text-white" : "bg-panel"}`}>
                  <p className="font-display text-6xl leading-none">V{v.versionNo}</p>
                  <div>
                    <p className="font-display text-2xl">{v.isLatest ? m.latest : m.replaced}</p>
                    <p className={v.isLatest ? "text-white/85" : "text-muted"}>
                      {m.issued} {formatDate(t.locale, v.issuedAt)}, {v.skillCount} {v.skillCount === 1 ? m.skillOne : m.skillMany}, {m.code}{" "}
                      <span className={`font-bold tracking-wider ${v.isLatest ? "text-white" : "text-ink"}`}>{v.code}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <a href={`/api/pdf/${v.code}`}
                      className={`px-5 pt-2.5 pb-2 font-display text-xl ${v.isLatest ? "bg-magenta text-white hover:bg-magenta-deep focus-visible:outline-white" : "border-2 border-ink text-ink hover:bg-ink hover:text-white"}`}>
                      {m.download}
                    </a>
                    <Link href={`/v/${v.code}`} className={v.isLatest ? "font-semibold text-white underline underline-offset-2" : link}>{m.openVerify}</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {latest && (
            <section aria-labelledby="share-h" className="mt-14 border-t-8 border-magenta bg-panel p-8">
              <h2 id="share-h" className="font-display text-4xl text-ink">{m.shareTitle}</h2>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed">{m.shareText}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a href={linkedInAddUrl({ passportId: passport.passportId, code: latest.code, issuedAt: latest.issuedAt }, baseUrl)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-3 bg-[#0a66c2] px-5 pt-2.5 pb-2 font-display text-xl text-white hover:bg-[#004182]">
                  <svg aria-hidden viewBox="0 0 24 24" className="mb-0.5 size-5 fill-current">
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                  {m.addLinkedIn}
                </a>
                <CopyLink url={verifyUrl(latest.code, baseUrl)} />
              </div>
              <p className="mt-3 text-sm text-muted">{m.linkedInNote}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
