// staff roles, lowest first. each role can do everything the ones before it can
import { isBtuAccount, sameEmail } from "./access.ts";

export const ROLES = ["viewer", "editor", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];

export const roleAtLeast = (role: Role | null, min: Role): boolean =>
  role !== null && ROLES.indexOf(role) >= ROLES.indexOf(min);

// ADMIN_EMAILS from the server config: always superadmin, so the website can never lock everyone out
export const bootstrapEmails = (adminEmails: string | undefined): string[] =>
  (adminEmails ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function resolveRole(user: { email: string; emailVerified: boolean }, staffRole: Role | null, adminEmails: string | undefined): Role | null {
  if (!isBtuAccount(user)) return null;
  if (bootstrapEmails(adminEmails).some((e) => sameEmail(e, user.email))) return "superadmin";
  return staffRole;
}
