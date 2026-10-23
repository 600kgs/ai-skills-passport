// who may use the student pages. google already limits sign-in to btu's workspace;
// this is the same rule checked on our side, so a config slip can't open it up.
export const BTU_DOMAIN = "btu.edu.ge";

const BTU_EMAIL = /^[^@\s]+@btu\.edu\.ge$/;

export function isBtuAccount(user: { email: string; emailVerified: boolean }): boolean {
  return user.emailVerified && BTU_EMAIL.test(user.email.trim().toLowerCase());
}

// a passport belongs to the student whose sheet email matches the google account
export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// admins are btu accounts listed in ADMIN_EMAILS (comma separated). unset or empty means nobody
export function isAdmin(user: { email: string; emailVerified: boolean }, adminEmails: string | undefined): boolean {
  if (!isBtuAccount(user)) return false;
  const list = (adminEmails ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  return list.some((e) => sameEmail(e, user.email));
}
