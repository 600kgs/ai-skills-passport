"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    // on success the browser leaves for google, so only a failure comes back here
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/me", errorCallbackURL: "/login" });
    if (error) {
      setBusy(false);
      setError("Couldn't reach Google sign-in. Check your connection and try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="bg-btu-orange px-6 py-3 text-lg font-black disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {busy ? "Opening Google..." : "Sign in with your BTU Google account"}
      </button>
      {error && <p role="alert" className="mt-4 border-l-4 border-btu-red pl-4">{error}</p>}
    </>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => { await authClient.signOut(); router.push("/"); }}
      className="font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      Sign out
    </button>
  );
}
