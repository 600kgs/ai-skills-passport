import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, LOCALE_COOKIE, type Dict, type Locale } from "./dictionaries";

// the visitor's choice if they made one; otherwise georgian when the browser lists it, english for
// everyone else, so an employer abroad who scans a qr code gets a page they can read
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (chosen === "ka" || chosen === "en") return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  return /(^|,)\s*ka\b/i.test(accept) ? "ka" : "en";
}

export async function getDict(): Promise<Dict> {
  return dictionaries[await getLocale()];
}
