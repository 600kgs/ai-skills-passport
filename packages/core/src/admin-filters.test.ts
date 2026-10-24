import { describe, expect, it } from "vitest";
import { activityFilters, passportFilters, queryString } from "./admin-filters.ts";

describe("passportFilters", () => {
  it("gives the default view for an empty url", () => {
    expect(passportFilters({})).toEqual({ q: "", program: "", level: "", updated: "", sort: "newest", page: 1 });
  });

  it("reads a shared link back", () => {
    expect(passportFilters({ q: " Giorgi ", program: "Computer Science", level: "Bachelor", updated: "yes", sort: "name", page: "3" }))
      .toEqual({ q: "Giorgi", program: "Computer Science", level: "Bachelor", updated: "yes", sort: "name", page: 3 });
  });

  it("falls back on anything a hand-edited link can hold", () => {
    expect(passportFilters({ sort: "passport_id; drop table", updated: "maybe", page: "-2" })).toMatchObject({ sort: "newest", updated: "", page: 1 });
    expect(passportFilters({ page: "1.5" }).page).toBe(1);
    expect(passportFilters({ page: "999999999" }).page).toBe(1);
    expect(passportFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("takes the first value when a key repeats", () => {
    expect(passportFilters({ sort: ["id", "name"] }).sort).toBe("id");
  });
});

describe("activityFilters", () => {
  it("defaults to everything, newest first", () => {
    expect(activityFilters({})).toEqual({ type: "", q: "", before: null, runsBefore: null, problemsOnly: false });
  });

  it("reads type, id search and paging", () => {
    expect(activityFilters({ type: "email", q: "btu-ai-000143", before: "120", runsBefore: "40", problems: "1" }))
      .toEqual({ type: "email", q: "BTU-AI-000143", before: 120, runsBefore: 40, problemsOnly: true });
  });

  it("ignores unknown types and bad cursors", () => {
    expect(activityFilters({ type: "toString", before: "abc", runsBefore: "0" })).toMatchObject({ type: "", before: null, runsBefore: null });
  });
});

describe("queryString", () => {
  it("keeps only set values", () => {
    expect(queryString({ q: "nino", program: "", page: 1, problems: true, before: null, sort: undefined, all: false })).toBe("?q=nino&page=1&problems=1");
    expect(queryString({ q: "" })).toBe("");
  });

  it("encodes what a search can contain", () => {
    expect(queryString({ q: "ნინო & co" })).toBe("?q=%E1%83%9C%E1%83%98%E1%83%9C%E1%83%9D+%26+co");
  });
});
