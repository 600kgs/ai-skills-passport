import { describe, expect, it } from "vitest";
import { activityFilters, passportFilters, queryString, recordFilters } from "./admin-filters.ts";

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
    expect(activityFilters({})).toEqual({ type: "", q: "", before: null });
  });

  it("reads type, id search and paging", () => {
    expect(activityFilters({ type: "records", q: "btu-ai-000143", before: "120" }))
      .toEqual({ type: "records", q: "BTU-AI-000143", before: 120 });
  });

  it("ignores unknown types and bad cursors", () => {
    expect(activityFilters({ type: "toString", before: "abc" })).toMatchObject({ type: "", before: null });
  });

  it("has no sheet type any more", () => {
    expect(activityFilters({ type: "sheet" }).type).toBe("");
    expect(activityFilters({ type: "staff" }).type).toBe("staff");
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

describe("record filters", () => {
  it("reads known values and drops the rest", () => {
    expect(recordFilters({ q: " nino ", verification: "PENDING", state: "pending", source: "excel", workshop: "7", page: "2" }))
      .toEqual({ q: "nino", verification: "PENDING", state: "pending", source: "excel", workshop: 7, page: 2 });
    expect(recordFilters({ verification: "MAYBE", state: "drop table", source: "x", workshop: "-1", page: "0" }))
      .toEqual({ q: "", verification: "", state: "", source: "", workshop: null, page: 1 });
  });
});
