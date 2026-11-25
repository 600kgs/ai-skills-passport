import "server-only";
import { type Role, roleAtLeast } from "@passport/core";
import { forbidden, redirect } from "next/navigation";
import { currentUser, type Viewer } from "@/lib/auth";

// signed out goes to sign-in; a signed-in account below the role gets 403
export async function requireRole(min: Role): Promise<Viewer> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!roleAtLeast(user.role, min)) forbidden();
  return user;
}
