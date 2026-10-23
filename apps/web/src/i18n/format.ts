import type { Locale } from "./dictionaries";

// "24 October 2026" / "24 ოქტომბერი, 2026", in tbilisi time
export const formatDate = (locale: Locale, d: Date | string) =>
  new Date(d).toLocaleDateString(locale === "ka" ? "ka-GE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tbilisi" });
