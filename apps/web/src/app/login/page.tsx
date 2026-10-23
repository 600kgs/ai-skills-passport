import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { getDict } from "@/i18n/server";
import { currentUser } from "@/lib/auth";

// already signed in goes straight to the passport; a failed google round trip says why
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/me");
  const [t, { error }] = await Promise.all([getDict(), searchParams]);
  const l = t.login;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-20 pb-16 sm:pt-28 sm:pb-24 md:grid-cols-2 md:items-start">
      <div>
        <h1 className="font-display text-6xl text-ink sm:text-7xl">{l.title}</h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed">{l.lead}</p>
        <p className="mt-10 max-w-md text-muted">
          {l.verifyOther}{" "}
          <Link href="/" className="font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta">{l.verifyOtherLink}</Link>
        </p>
      </div>
      <div className="border-t-8 border-magenta bg-panel p-8">
        {error && <p role="alert" className="mb-6 border-l-[12px] border-magenta bg-white p-4">{l.wrongAccount}</p>}
        <SignInButton />
      </div>
    </main>
  );
}
