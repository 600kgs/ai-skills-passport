import { describe, expect, it } from "vitest";
import { linkedInAddUrl } from "./share.ts";

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
