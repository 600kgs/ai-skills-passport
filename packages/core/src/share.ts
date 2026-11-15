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
export const skillUrl = (link: string, publicBaseUrl: string) => `${publicBaseUrl.replace(/\/$/, "")}/s/${link}`;

// one skill as its own linkedin certification. the certId pairs the passport with the catalog skill id,
// so callers must merge a student's duplicate rows of one skill first. null when the date isn't usable
export function linkedInSkillAddUrl(
  s: { passportId: string; skillId: string; skillName: string; dateEarned: string; link: string },
  publicBaseUrl: string,
): string | null {
  // the sheet's calendar date, already btu's own day: no time zone to convert
  const m = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(s.dateEarned);
  if (!m) return null;
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: s.skillName,
    organizationId: BTU_LINKEDIN_ORG_ID,
    issueYear: m[1]!,
    issueMonth: String(Number(m[2]!)),
    // the skill's own permanent page: it never reads "outdated" and shows no other skill
    certUrl: skillUrl(s.link, publicBaseUrl),
    certId: `${s.passportId}-${s.skillId}`,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

// the per-skill links for /me. a skill whose date can't be read is left out rather than
// breaking the whole page; the caller can log what's missing
export function linkedInSkillLinks<T extends { skillId: string; skillName: string; dateEarned: string; link: string }>(
  skills: T[], passportId: string, publicBaseUrl: string,
): (T & { url: string })[] {
  return skills.flatMap((s) => {
    const url = linkedInSkillAddUrl({ ...s, passportId }, publicBaseUrl);
    return url ? [{ ...s, url }] : [];
  });
}
