// workshops and hackathons the career center lists on the site. students register on an outside form;
// the event's own page here only links to it
export const WORKSHOP_KINDS = ["workshop", "hackathon"] as const;
export type WorkshopKind = (typeof WORKSHOP_KINDS)[number];
export const WORKSHOP_STATUSES = ["draft", "published", "cancelled"] as const;
export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

// times as the form's datetime-local gives them ("2026-11-25T11:00"), meant in tbilisi time
export type WorkshopInput = {
  kind: WorkshopKind; title: string; titleEn: string | null; description: string; descriptionEn: string | null;
  trainer: string; startsAt: string; endsAt: string | null; location: string; skillId: string | null; registrationUrl: string;
};

// georgia keeps UTC+4 all year, no daylight saving
const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
export function fromTbilisi(s: string): Date | null {
  const m = LOCAL.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00+04:00`);
  // 2026-02-31 rolls over to march; the round trip catches it
  return Number.isNaN(d.getTime()) || toTbilisi(d) !== s.trim() ? null : d;
}
export const toTbilisi = (d: Date) => new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 16);

export function validateWorkshop(w: WorkshopInput): string[] {
  const errors: string[] = [];
  if (!(WORKSHOP_KINDS as readonly string[]).includes(w.kind)) errors.push(`kind must be workshop or hackathon`);
  if (!w.title.trim()) errors.push("title is required");
  if (!w.trainer.trim()) errors.push("trainer is required");
  if (!w.location.trim()) errors.push("place is required");
  const start = fromTbilisi(w.startsAt);
  if (!start) errors.push(`start "${w.startsAt}" isn't a real date and time`);
  if (w.endsAt) {
    const end = fromTbilisi(w.endsAt);
    if (!end) errors.push(`end "${w.endsAt}" isn't a real date and time`);
    else if (start && end <= start) errors.push("the end must be after the start");
  }
  // only https links: the button opens it for every visitor, so javascript: or plain http never gets through
  let url: URL | null = null;
  try { url = new URL(w.registrationUrl.trim()); } catch {}
  if (!url || url.protocol !== "https:" || !url.hostname) errors.push("the registration link must be a full https:// address");
  return errors;
}

// listed until it ends; an event with only a start stays for a day
export const isUpcoming = (w: { startsAt: Date; endsAt: Date | null }, now: Date) =>
  (w.endsAt ?? new Date(w.startsAt.getTime() + 24 * 3600_000)) > now;
