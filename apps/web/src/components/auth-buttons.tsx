"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const t = useDict().login;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(false);
    // on success the browser leaves for google, so only a failure comes back here
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/me", errorCallbackURL: "/login" });
    if (error) {
      setBusy(false);
      setError(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 bg-magenta px-6 pt-3.5 pb-3 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 48 48" className="mb-1 size-7 shrink-0 rounded-full bg-white p-1">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
        </svg>
        {busy ? t.opening : t.button}
      </button>
      {error && <p role="alert" className="mt-4 border-l-[12px] border-magenta bg-white p-4">{t.googleError}</p>}
    </>
  );
}

export function SignOutButton() {
  const t = useDict().me;
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await authClient.signOut(); router.push("/"); }}
      className="font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta">
      {t.signOut}
    </button>
  );
}
