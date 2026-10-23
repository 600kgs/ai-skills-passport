import "server-only";
import { forbidden, redirect } from "next/navigation";
import { currentUser, type Student } from "@/lib/auth";

// signed out goes to sign-in; a signed-in student who isn't an admin gets 403
export async function requireAdmin(): Promise<Student> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) forbidden();
  return user;
}
