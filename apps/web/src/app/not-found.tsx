import Link from "next/link";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const f = (await getDict()).notFound;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="border-t-8 border-blue bg-panel p-8">
        <h1 className="font-display text-5xl text-ink sm:text-6xl">{f.title}</h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed">{f.text}</p>
        <Link href="/" className="mt-8 inline-block bg-magenta px-6 pt-3 pb-2.5 font-display text-2xl text-white hover:bg-magenta-deep">{f.link}</Link>
      </div>
    </main>
  );
}
