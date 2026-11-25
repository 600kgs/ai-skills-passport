import { describe, expect, it } from "vitest";
import { fromTbilisi, isUpcoming, toTbilisi, validateWorkshop, type WorkshopInput } from "./workshops.ts";

const w: WorkshopInput = {
  kind: "workshop", title: "AI-Assisted Research", titleEn: null, description: "From information to insights", descriptionEn: null,
  trainer: "Tsotne Zhgenti", startsAt: "2026-11-25T11:00", endsAt: "2026-11-25T14:00", location: "Room 305",
  skillId: "SKL-006", registrationUrl: "https://forms.gle/abc",
};

describe("workshop fields", () => {
  it("accepts a complete workshop", () => {
    expect(validateWorkshop(w)).toEqual([]);
    expect(validateWorkshop({ ...w, endsAt: null, skillId: null, kind: "hackathon" })).toEqual([]);
  });

  it("refuses javascript: and http: registration urls", () => {
    expect(validateWorkshop({ ...w, registrationUrl: "javascript:alert(1)" })).toHaveLength(1);
    expect(validateWorkshop({ ...w, registrationUrl: "http://forms.gle/abc" })).toHaveLength(1);
    expect(validateWorkshop({ ...w, registrationUrl: "https://" })).toHaveLength(1);
  });

  it("refuses endsAt before startsAt and an impossible date", () => {
    expect(validateWorkshop({ ...w, endsAt: "2026-11-25T10:00" })).toHaveLength(1);
    expect(validateWorkshop({ ...w, startsAt: "2026-02-31T10:00" })).toHaveLength(1);
  });

  it("refuses an unknown kind and missing title, trainer or place", () => {
    expect(validateWorkshop({ ...w, kind: "party" as never, title: " ", trainer: "", location: "" })).toHaveLength(4);
  });
});

describe("tbilisi time", () => {
  it("reads a form's local time as UTC+4 and writes it back", () => {
    const d = fromTbilisi("2026-11-25T11:00")!;
    expect(d.toISOString()).toBe("2026-11-25T07:00:00.000Z");
    expect(toTbilisi(d)).toBe("2026-11-25T11:00");
    expect(fromTbilisi("nonsense")).toBe(null);
  });
});

describe("upcoming", () => {
  const start = new Date("2026-11-25T07:00:00Z");
  it("is true before and during the event, false after it ends", () => {
    const end = new Date("2026-11-25T10:00:00Z");
    expect(isUpcoming({ startsAt: start, endsAt: end }, new Date("2026-11-24T00:00:00Z"))).toBe(true);
    expect(isUpcoming({ startsAt: start, endsAt: end }, new Date("2026-11-25T08:00:00Z"))).toBe(true);
    expect(isUpcoming({ startsAt: start, endsAt: end }, new Date("2026-11-25T10:01:00Z"))).toBe(false);
  });

  it("a start-only event stays listed for a day", () => {
    expect(isUpcoming({ startsAt: start, endsAt: null }, new Date("2026-11-26T06:59:00Z"))).toBe(true);
    expect(isUpcoming({ startsAt: start, endsAt: null }, new Date("2026-11-26T07:01:00Z"))).toBe(false);
  });
});
