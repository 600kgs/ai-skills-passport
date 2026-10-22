import { describe, expect, it } from "vitest";
import type { Category } from "@passport/core";
import { renderHtml, type Passport, type Skill } from "./template.ts";

const CATS: Category[] = ["AI Skill", "AI Applied Skill", "AI Advanced Skill"];
const skills = (n: number): Skill[] => Array.from({ length: n }, (_, i) => ({
  name: `Skill ${i + 1}`, category: CATS[i % 3]!, description: "d", earnedThrough: null, dateEarned: "2026-10-01",
}));
const passport = (n: number, extra: Partial<Passport> = {}): Passport => ({
  passportId: "BTU-AI-000125", firstName: "Giorgi", lastName: "Kapanadze", firstIssued: "2026-09-15",
  version: 1, verificationCode: "7KQ4-M2XD-9P", verifyUrl: "https://passport.btumarket.ge/v/7KQ4-M2XD-9P", skills: skills(n), ...extra,
});
const pages = (html: string) => html.match(/<section class="page /g)?.length ?? 0;

describe("passport pdf layout", () => {
  // cover + about, then one skillset page per 10 skills and one detail page per 5
  it.each([[1, 4], [5, 4], [6, 5], [10, 5], [11, 7], [25, 10]])("%i skills make %i pages", async (n, expected) => {
    expect(pages(await renderHtml(passport(n)))).toBe(expected);
  });

  it("puts the passport id, code and qr on every page", async () => {
    const html = await renderHtml(passport(11));
    const footers = html.match(/<footer>[\s\S]*?<\/footer>/g) ?? [];
    expect(footers).toHaveLength(pages(html));
    for (const f of footers) {
      expect(f).toContain("BTU-AI-000125");
      expect(f).toContain("7KQ4-M2XD-9P");
      expect(f).toContain("<svg");
    }
  });

  it("escapes names from the sheet", async () => {
    const html = await renderHtml(passport(1, { firstName: "<b>Nino</b>", lastName: "O'Brien" }));
    expect(html).not.toContain("<b>Nino</b>");
    expect(html).toContain("&#60;b&#62;Nino&#60;/b&#62;");
  });
});
