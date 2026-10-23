"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./dictionaries";

export async function setLocale(locale: Locale) {
  if (locale !== "ka" && locale !== "en") return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
