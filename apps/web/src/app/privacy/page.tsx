import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy | BTU AI Skills Digital Passport" };

const CONTACT = "otaritomas.sepashvili.1@btu.edu.ge";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="inline-block text-2xl leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
        <span className="block font-black">AI SKILLS</span>
        <span className="block">DIGITAL PASSPORT</span>
      </Link>
      <h1 className="mt-10 text-3xl font-black">Privacy</h1>
      <p className="mt-2 text-muted">How the passport handles your data. Last updated 22 October 2026.</p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <Section title="What we keep">
          Your name, student ID, BTU email, program, study level and the AI skills BTU confirmed for you. It comes from
          BTU&apos;s skills record and is used only to issue, update and verify your passport.
        </Section>
        <Section title="What goes on the blockchain">
          For each passport version, only a fingerprint of the PDF (a SHA-256 hash) and the version number. No name,
          email or skill is written there. The fingerprint can&apos;t be turned back into the file.
        </Section>
        <Section title="Who can see your passport">
          Anyone who has a verification code sees the name, passport ID and skills of that version, the same as printed on
          the PDF. The code is only printed on your PDF, so you decide who gets it by deciding who gets the file.
        </Section>
        <Section title="Signing in">
          Google tells us your BTU email and name so we can find your passport. We don&apos;t store anything from your
          Google account. Your session is an encrypted cookie that ends when you sign out or after 12 hours.
        </Section>
        <Section title="Checking a PDF">
          When someone drops a PDF on a verify page, the file stays in their browser. Only its fingerprint is compared
          with the record.
        </Section>
        <Section title="Questions or corrections">
          Write to <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. Issued versions can&apos;t be
          edited, but a corrected record produces a new version, and the old one is marked as outdated.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b-2 border-foreground pb-2 text-xl font-black">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  );
}
