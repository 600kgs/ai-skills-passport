import "server-only";
import { headers } from "next/headers";
import { BTU_DOMAIN, isAdmin, isBtuAccount } from "@passport/core";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// no database: the session is an encrypted cookie. we only need to know who is signed in,
// and the passport data is looked up by email. sign-out or expiry ends it.
function createAuth() {
  return betterAuth({
    baseURL: process.env.PUBLIC_BASE_URL,
    secret: process.env.AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID ?? "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
        // google only offers btu workspace accounts and rejects tokens from anywhere else
        hd: BTU_DOMAIN,
        prompt: "select_account",
      },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      cookieCache: { enabled: true, maxAge: 60 * 60 * 12, strategy: "jwe" },
    },
    plugins: [nextCookies()],
  });
}

// built on first use, not at import: `next build` loads every route without the env
const g = globalThis as unknown as { passportAuth?: ReturnType<typeof createAuth> };
export const getAuth = () => (g.passportAuth ??= createAuth());

export type Student = { email: string; name: string; isAdmin: boolean };

// the signed-in btu account, or null for anyone else
export async function currentUser(): Promise<Student | null> {
  // read the request first: during the build this is where the page stops prerendering
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || !isBtuAccount(session.user)) return null;
  return { email: session.user.email, name: session.user.name, isAdmin: isAdmin(session.user, process.env.ADMIN_EMAILS) };
}

// every admin page and action calls this itself; nothing relies on a layout or link being hidden
export async function currentAdmin(): Promise<Student | null> {
  const user = await currentUser();
  return user?.isAdmin ? user : null;
}
