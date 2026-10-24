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

// which audit actions each activity filter shows
export const ACTIVITY_TYPES = {
  admin: ["record_confirmed", "record_rejected", "sync_requested", "rows_imported", "ledger_reset"],
  issued: ["passport_created", "version_issued"],
  sheet: ["award_recorded", "award_updated"],
  email: ["student_notified"],
} as const;
export type ActivityType = keyof typeof ACTIVITY_TYPES;

export type ActivityFilters = {
  type: ActivityType | "";
  // a passport id or record id, matched against the log entry's subject
  q: string;
  // keyset paging: show entries older than this id. stays fast however long the log grows
  before: number | null;
  runsBefore: number | null;
  problemsOnly: boolean;
};

export function activityFilters(p: Params): ActivityFilters {
  const type = one(p, "type");
  return {
    // own keys only: "toString" is "in" every object
    type: Object.hasOwn(ACTIVITY_TYPES, type) ? (type as ActivityType) : "",
    q: text(p, "q", 40).toUpperCase(),
    before: id(p, "before"),
    runsBefore: id(p, "runsBefore"),
    problemsOnly: one(p, "problems") === "1",
  };
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
