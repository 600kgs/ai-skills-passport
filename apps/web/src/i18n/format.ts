import type { Locale } from "./dictionaries";

const intlLocale = (l: Locale) => (l === "ka" ? "ka-GE" : "en-GB");

const KA_MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];

// "24 October 2026" / "24 ოქტომბერი, 2026", in tbilisi time. browsers often ship without georgian date
// data (chrome on windows falls back to "October 24, 2026"), so the georgian month names are ours
export function formatDate(locale: Locale, d: Date | string) {
  const date = new Date(d);
  if (locale !== "ka") return date.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tbilisi" });
  const [year, month, day] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" }).split("-").map(Number);
  return `${day} ${KA_MONTHS[month! - 1]}, ${year}`;
}

export const formatDateTime = (locale: Locale, d: Date) =>
  d.toLocaleString(intlLocale(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tbilisi" });

// "2 minutes ago" / "2 წუთის წინ"; older than a day shows the date and time
export function formatAgo(locale: Locale, d: Date, now = Date.now()) {
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  if (s < 60) return rtf.format(-s, "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return formatDateTime(locale, d);
}

// fills "{name}" placeholders in a dictionary text
export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
