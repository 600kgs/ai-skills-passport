// linkedin's "add to profile" link for a passport version: opens the student's own
// "add certification" form, filled in. nothing is posted until they press save.
// format: https://addtoprofile.linkedin.com

// linkedin.com/company/28901188 redirects to btu's school page (checked 2026-10-24); with the id,
// linkedin shows btu's logo and page on the certificate instead of plain text
export const BTU_LINKEDIN_ORG_ID = "28901188";
export const PASSPORT_NAME = "AI Skills Digital Passport";

export function linkedInAddUrl(v: { passportId: string; code: string; issuedAt: Date }, publicBaseUrl: string): string {
  // the issue month as btu sees it, in tbilisi, not the server's time zone
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", timeZone: "Asia/Tbilisi" }).formatToParts(v.issuedAt);
  const part = (t: string) => parts.find((p) => p.type === t)!.value;
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: PASSPORT_NAME,
    organizationId: BTU_LINKEDIN_ORG_ID,
    issueYear: part("year"),
    issueMonth: part("month"),
    // the code, not the passport id: ids are sequential, so an id link would let anyone walk through students
    certUrl: `${publicBaseUrl.replace(/\/$/, "")}/v/${v.code}`,
    certId: v.passportId,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

export const verifyUrl = (code: string, publicBaseUrl: string) => `${publicBaseUrl.replace(/\/$/, "")}/v/${code}`;
