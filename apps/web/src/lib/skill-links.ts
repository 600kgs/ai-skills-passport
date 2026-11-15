import "server-only";
import { attestationAddressFor, newVerificationCode } from "@passport/core";
import { and, eq, inArray, passports, passportVersions, skillAwards, skillLinks, students } from "@passport/db";
import { getDb } from "@/lib/db";

// the student's permanent link for each skill, made the first time /me shows it and never changed after,
// since linkedin keeps whatever url it was given
export async function skillLinkCodes(passportId: string, skillIds: string[]): Promise<Map<string, string>> {
  if (!skillIds.length) return new Map();
  const db = getDb();
  const read = () => db.select().from(skillLinks).where(and(eq(skillLinks.passportId, passportId), inArray(skillLinks.skillId, skillIds)));
  let rows = await read();
  const missing = skillIds.filter((id) => !rows.some((r) => r.skillId === id));
  if (missing.length) {
    // two tabs opening /me at once: the unique index keeps the first link, the second insert is skipped
    await db.insert(skillLinks).values(missing.map((skillId) => ({ code: newVerificationCode(), passportId, skillId }))).onConflictDoNothing();
    rows = await read();
  }
  return new Map(rows.map((r) => [r.skillId, r.code]));
}

export type SkillCheck = {
  // confirmed: the skill is in the passport's current version. withdrawn: btu took it out (a revoked version)
  status: "confirmed" | "withdrawn";
  holder: string;
  credentialId: string;
  skill: { name: string; category: string; earnedThrough: string | null; dateEarned: string };
  // where the chain record of the version listing the skill lives. the version code itself stays
  // private: it would open the whole passport, and the student shared only this skill
  record: string | null;
};

export async function skillByLink(code: string): Promise<SkillCheck | null> {
  const db = getDb();
  const [row] = await db.select({ link: skillLinks, passport: passports, student: students })
    .from(skillLinks)
    .innerJoin(passports, eq(passports.passportId, skillLinks.passportId))
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .where(eq(skillLinks.code, code));
  if (!row) return null;
  const { link, passport, student } = row;

  // every row of this skill for the student; one skill can sit on the sheet twice
  const awards = await db.select().from(skillAwards)
    .where(and(eq(skillAwards.studentId, student.studentId), eq(skillAwards.skillId, link.skillId)));
  const [latest] = passport.latestVersionId
    ? await db.select().from(passportVersions).where(and(eq(passportVersions.id, passport.latestVersionId), eq(passportVersions.state, "issued")))
    : [];
  const recordIds = new Set(awards.map((a) => a.recordId).filter((id) => latest?.includedRecordIds.includes(id)));
  // what the version printed, or the live rows for versions issued before snapshots existed
  const printed = latest && !latest.revokedAt
    ? (latest.skills ?? awards).filter((s) => recordIds.has(s.recordId)).sort((a, b) => a.dateEarned.localeCompare(b.dateEarned))
    : [];
  const shown = printed[0] ?? [...awards].sort((a, b) => a.dateEarned.localeCompare(b.dateEarned))[0];
  if (!shown) return null;

  const authority = process.env.AUTHORITY_ADDRESS;
  const record = !printed.length || !latest ? null
    : latest.attestationAddress ?? (authority ? await attestationAddressFor(authority, latest.verificationCode) : null);
  return {
    status: printed.length ? "confirmed" : "withdrawn",
    holder: `${student.firstName} ${student.lastName}`,
    credentialId: `${passport.passportId}-${link.skillId}`,
    skill: { name: shown.skillName, category: shown.category, earnedThrough: shown.earnedThrough, dateEarned: shown.dateEarned },
    record,
  };
}
