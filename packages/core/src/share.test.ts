import { describe, expect, it } from "vitest";
import { linkedInAddUrl } from "./share.ts";
import { linkedInSkillAddUrl } from "./share.ts";
import { linkedInSkillLinks } from "./share.ts";

const version = { passportId: "BTU-AI-000143", code: "F8ZZ-YDVZ-SH", issuedAt: new Date("2026-10-23T21:27:51Z") };

describe("linkedInAddUrl", () => {
  it("fills linkedin's certification form with btu as the issuer and the verify page as proof", () => {
    const url = new URL(linkedInAddUrl(version, "https://passport.btumarket.ge/"));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/profile/add");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: "CERTIFICATION_NAME",
      name: "AI Skills Digital Passport",
      organizationId: "28901188",
      issueYear: "2026",
      issueMonth: "10",
      certUrl: "https://passport.btumarket.ge/v/F8ZZ-YDVZ-SH",
      certId: "BTU-AI-000143",
    });
  });

  it("takes the month in tbilisi time, where late evening utc is already the next day", () => {
    const url = new URL(linkedInAddUrl({ ...version, issuedAt: new Date("2026-10-31T21:30:00Z") }, "https://x.ge"));
    expect(url.searchParams.get("issueMonth")).toBe("11");
  });
});

const skill = { passportId: "BTU-AI-000143", skillId: "SKL-008", skillName: "AI Workflow Automation", dateEarned: "2026-10-23", code: "F8ZZ-YDVZ-SH" };

describe("linkedInSkillAddUrl", () => {
  it("fills linkedin's certification form with the skill, btu as the issuer and the verify page as proof", () => {
    const url = new URL(linkedInSkillAddUrl(skill, "https://passport.btumarket.ge/")!);
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/profile/add");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: "CERTIFICATION_NAME",
      name: "AI Workflow Automation",
      organizationId: "28901188",
      issueYear: "2026",
      issueMonth: "10",
      certUrl: "https://passport.btumarket.ge/v/F8ZZ-YDVZ-SH",
      certId: "BTU-AI-000143-SKL-008",
    });
  });

  it("writes the month without a leading zero, like the passport button", () => {
    const url = new URL(linkedInSkillAddUrl({ ...skill, dateEarned: "2026-01-05" }, "https://x.ge")!);
    expect(url.searchParams.get("issueYear")).toBe("2026");
    expect(url.searchParams.get("issueMonth")).toBe("1");
  });

  it("keeps the earned date's own month, with no time zone shift", () => {
    const url = new URL(linkedInSkillAddUrl({ ...skill, dateEarned: "2026-10-31" }, "https://x.ge")!);
    expect(url.searchParams.get("issueMonth")).toBe("10");
  });

  it("keeps georgian and special characters in the skill name intact", () => {
    const name = "AI & Data: ხელოვნური ინტელექტი #1";
    expect(new URL(linkedInSkillAddUrl({ ...skill, skillName: name }, "https://x.ge")!).searchParams.get("name")).toBe(name);
  });

  it("gives no link for a date that isn't yyyy-mm-dd with a real month", () => {
    for (const dateEarned of ["23/10/2026", "2026-10-23T00:00:00Z", "2026-13-01", "2026-00-10", ""]) {
      expect(linkedInSkillAddUrl({ ...skill, dateEarned }, "https://x.ge")).toBeNull();
    }
  });
});

describe("linkedInSkillLinks", () => {
  it("skips a skill with a bad date and keeps the rest, with their own fields", () => {
    const skills = [
      { recordId: "REC-0001", skillId: "SKL-001", skillName: "AI Literacy", dateEarned: "2026-09-12" },
      { recordId: "REC-0002", skillId: "SKL-002", skillName: "Prompting", dateEarned: "12.09.2026" },
      { recordId: "REC-0003", skillId: "SKL-008", skillName: "AI Workflow Automation", dateEarned: "2026-10-23" },
    ];
    const links = linkedInSkillLinks(skills, { passportId: "BTU-AI-000143", code: "F8ZZ-YDVZ-SH" }, "https://x.ge");
    expect(links.map((l) => l.recordId)).toEqual(["REC-0001", "REC-0003"]);
    expect(new URL(links[1]!.url).searchParams.get("certId")).toBe("BTU-AI-000143-SKL-008");
    expect(new URL(links[1]!.url).searchParams.get("certUrl")).toBe("https://x.ge/v/F8ZZ-YDVZ-SH");
  });

  it("gives an empty list when no date is usable", () => {
    expect(linkedInSkillLinks([{ skillId: "SKL-001", skillName: "AI Literacy", dateEarned: "soon" }], { passportId: "BTU-AI-000143", code: "C" }, "https://x.ge")).toEqual([]);
  });
});
