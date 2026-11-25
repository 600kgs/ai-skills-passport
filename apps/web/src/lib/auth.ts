import "server-only";
import { headers } from "next/headers";
import { BTU_DOMAIN, isBtuAccount, resolveRole, type Role, roleAtLeast } from "@passport/core";
import { getStaffRole } from "@passport/ledger";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";

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

// role = staff role, null for students. read from the database on every request (never kept in the cookie),
// so a role change applies at once
export type Viewer = { email: string; name: string; role: Role | null };

// the signed-in btu account, or null for anyone else
export async function currentUser(): Promise<Viewer | null> {
  // read the request first: during the build this is where the page stops prerendering
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || !isBtuAccount(session.user)) return null;
  const stored = await getStaffRole(getDb(), session.user.email);
  return { email: session.user.email, name: session.user.name, role: resolveRole(session.user, stored, process.env.ADMIN_EMAILS) };
}

// every admin page and action calls this itself; nothing relies on a layout or link being hidden
export async function currentStaff(min: Role): Promise<Viewer | null> {
  const user = await currentUser();
  return user && roleAtLeast(user.role, min) ? user : null;
}
