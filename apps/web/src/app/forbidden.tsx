import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
      <h1 className="text-3xl font-black">This page is for passport admins</h1>
      <p className="mt-4 max-w-prose">
        Your BTU account isn&apos;t on the admin list. If you should have access, ask the passport team to add your email.
      </p>
      <p className="mt-8"><Link href="/me" className="font-bold underline">Go to your passport</Link></p>
    </main>
  );
}
