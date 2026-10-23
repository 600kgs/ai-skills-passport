import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth-buttons";
import { currentUser } from "@/lib/auth";
import { passportForEmail } from "@/lib/passports";

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tbilisi" });

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Link href="/" className="inline-block text-2xl leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
        <span className="block font-black">AI SKILLS</span>
        <span className="block">DIGITAL PASSPORT</span>
      </Link>
      <Suspense fallback={<p className="mt-10 text-muted">Loading your passport...</p>}>
        <MyPassport />
      </Suspense>
    </main>
  );
}

async function MyPassport() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const passport = await passportForEmail(user.email);

  return (
    <>
      <p className="mt-6 text-sm text-muted">
        Signed in as {user.email}. <SignOutButton />
        {user.isAdmin && <> <Link href="/admin" className="ml-3 font-bold underline">Open admin</Link></>}
      </p>

      {!passport ? (
        <section className="mt-10 max-w-prose">
          <h1 className="text-3xl font-black">No passport yet</h1>
          <p className="mt-4">
            There&apos;s no AI Skills Passport for {user.email}. BTU issues it once your first AI skill is confirmed.
            If you already have confirmed skills, ask the office that records them to check that this email is on your record.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-10">
            <h1 className="text-3xl font-black sm:text-4xl">{passport.holder}</h1>
            <p className="mt-2 text-lg">Passport {passport.passportId}</p>
            <p className="mt-6 max-w-prose text-muted">
              Send the PDF to anyone who needs to check your skills. They open the code printed next to the QR on this site and drop the file in.
              Each new skill gives a new version; older ones still verify, marked as outdated.
            </p>
          </section>

          <section aria-labelledby="versions-h" className="mt-12">
            <h2 id="versions-h" className="border-b-2 border-foreground pb-2 text-xl font-black">Versions</h2>
            <ul>
              {passport.versions.map((v) => (
                <li key={v.code} className="flex flex-col gap-4 border-b border-line py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black">
                      V{v.versionNo}{" "}
                      {v.isLatest
                        ? <span className="text-base font-bold text-btu-navy">latest</span>
                        : <span className="text-base font-bold text-muted">replaced by a newer version</span>}
                    </p>
                    <p className="mt-1 text-muted">
                      Issued {day(v.issuedAt)}, {v.skillCount} {v.skillCount === 1 ? "skill" : "skills"}, code <span className="font-bold tracking-wider text-foreground">{v.code}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <a
                      href={`/api/pdf/${v.code}`}
                      className={`px-5 py-2 font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${v.isLatest ? "bg-btu-orange" : "border-2 border-foreground"}`}
                    >
                      Download PDF
                    </a>
                    <Link href={`/v/${v.code}`} className="underline">Open its verify page</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
