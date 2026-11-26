// the admin lists keep their search, filters, sort and page in the url, so a view can be shared as a link.
// these read them back defensively: a hand-edited link falls back to the defaults, never reaches a query raw
export const PASSPORTS_PER_PAGE = 25;
export const ACTIVITY_PER_PAGE = 50;

type Params = Record<string, string | string[] | undefined>;

const one = (p: Params, key: string) => {
  const v = p[key];
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
};
const text = (p: Params, key: string, max = 100) => one(p, key).slice(0, max);
const pageNo = (p: Params, key: string) => {
  const n = Number(one(p, key));
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
};
const id = (p: Params, key: string) => {
  const n = Number(one(p, key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const PASSPORT_SORTS = ["newest", "name", "id", "versions"] as const;
export type PassportSort = (typeof PASSPORT_SORTS)[number];

export type PassportFilters = {
  q: string;
  program: string;
  level: string;
  updated: "" | "yes" | "no";
  sort: PassportSort;
  page: number;
};

export function passportFilters(p: Params): PassportFilters {
  const sort = one(p, "sort");
  const updated = one(p, "updated");
  return {
    q: text(p, "q"),
    program: text(p, "program", 200),
    level: text(p, "level", 200),
    updated: updated === "yes" || updated === "no" ? updated : "",
    sort: (PASSPORT_SORTS as readonly string[]).includes(sort) ? (sort as PassportSort) : "newest",
    page: pageNo(p, "page"),
  };
}

export const RECORDS_PER_PAGE = 25;
export const RECORD_STATES = ["pending", "applied", "ignored", "failed", "deleted", "withdrawn"] as const;
export const RECORD_SOURCES = ["sheet", "web", "excel", "workshop"] as const;

export type RecordFilters = {
  q: string;
  verification: "" | "PENDING" | "CONFIRMED" | "REJECTED";
  state: "" | (typeof RECORD_STATES)[number];
  source: "" | (typeof RECORD_SOURCES)[number];
  workshop: number | null;
  page: number;
};

const pick = <T extends string>(v: string, list: readonly T[]): T | "" => ((list as readonly string[]).includes(v) ? (v as T) : "");

export function recordFilters(p: Params): RecordFilters {
  return {
    q: text(p, "q"),
    verification: pick(one(p, "verification"), ["PENDING", "CONFIRMED", "REJECTED"] as const),
    state: pick(one(p, "state"), RECORD_STATES),
    source: pick(one(p, "source"), RECORD_SOURCES),
    workshop: id(p, "workshop"),
    page: pageNo(p, "page"),
  };
}

// which audit actions each activity filter shows
export const ACTIVITY_TYPES = {
  records: ["record_created", "record_updated", "record_deleted", "record_confirmed", "record_rejected", "rows_imported", "student_updated", "record_withdrawn"],
  issued: ["passport_created", "version_issued", "version_revoked", "ledger_reset"],
  workshops: ["workshop_created", "workshop_updated", "workshop_published", "workshop_unpublished", "workshop_cancelled", "registrations_uploaded", "workshop_records_created", "registration_renamed"],
  staff: ["staff_added", "staff_role_changed", "staff_removed", "skill_added", "skill_updated"],
  email: ["student_notified"],
} as const;
export type ActivityType = keyof typeof ACTIVITY_TYPES;

export type ActivityFilters = {
  type: ActivityType | "";
  // a passport id or record id, matched against the log entry's subject
  q: string;
  page: number;
};

export function activityFilters(p: Params): ActivityFilters {
  const type = one(p, "type");
  return {
    // own keys only: "toString" is "in" every object
    type: Object.hasOwn(ACTIVITY_TYPES, type) ? (type as ActivityType) : "",
    q: text(p, "q", 40).toUpperCase(),
    page: pageNo(p, "page"),
  };
}

// the page links a list shows: both ends, the current page and its neighbours, "gap" where pages are skipped.
// a gap never hides a single page; that page is shown instead
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 2) [2, 3].forEach((n) => keep.add(n));
  if (page >= pages - 1) [pages - 2, pages - 1].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const n of nums) {
    const prev = out.at(-1);
    if (typeof prev === "number" && n - prev === 2) out.push(n - 1);
    else if (typeof prev === "number" && n - prev > 2) out.push("gap");
    out.push(n);
  }
  return out;
}

// "?a=1&b=x" from the set values only, so default views keep short, clean links
export function queryString(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    params.set(k, v === true ? "1" : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
