import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BTU_DOMAIN } from "@passport/core";
import { SignInButton } from "@/components/auth-buttons";
import { currentUser } from "@/lib/auth";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
      <h1 className="text-4xl leading-none sm:text-5xl">
        <Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
          <span className="block font-black">AI SKILLS</span>
          <span className="block">DIGITAL PASSPORT</span>
        </Link>
      </h1>
      <p className="mt-6 max-w-prose text-muted">
        Students sign in to download their passport and share it. Use the Google account that ends in @{BTU_DOMAIN}.
      </p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <SignInState searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-10 text-sm text-muted">
        Checking someone else&apos;s passport? You don&apos;t need an account: <Link href="/" className="underline">enter its verification code</Link>.
      </p>
    </main>
  );
}

// already signed in goes straight to the passport; a failed google round trip says why
async function SignInState({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  if (await currentUser()) redirect("/me");
  const { error } = await searchParams;
  return (
    <>
      {error && (
        <p role="alert" className="mb-6 border-l-4 border-btu-red pl-4">
          That account can&apos;t sign in here. Choose your @{BTU_DOMAIN} account in the Google window, not a personal one.
        </p>
      )}
      <SignInButton />
    </>
  );
}
