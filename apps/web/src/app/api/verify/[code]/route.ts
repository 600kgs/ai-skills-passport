// what the server adds to the chain check: whether this version is the latest or was revoked,
// and the fields already printed on the pdf. nothing beyond that is exposed.
import { normalizeCode } from "@passport/core";
import { and, eq, inArray, passports, passportVersions, skillAwards, students } from "@passport/db";
import { getDb } from "@/lib/db";
import { allow, clientKey } from "@/lib/rate-limit";

export type VerifyInfo = {
  passportId: string;
  holder: string;
  versionNo: number;
  issuedAt: string;
  skills: { name: string; category: string; earnedThrough: string | null; dateEarned: string }[];
  isLatest: boolean;
  latest: { versionNo: number; issuedAt: string };
  revoked: { at: string; reason: string } | null;
};

export async function GET(req: Request, ctx: RouteContext<"/api/verify/[code]">) {
  if (!allow(clientKey(req))) return Response.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });
  const code = normalizeCode((await ctx.params).code);
  if (!code) return Response.json({ error: "not found" }, { status: 404 });

  const db = getDb();
  const [row] = await db.select({ version: passportVersions, passport: passports, student: students })
    .from(passportVersions)
    .innerJoin(passports, eq(passports.passportId, passportVersions.passportId))
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .where(and(eq(passportVersions.verificationCode, code), eq(passportVersions.state, "issued")));
  if (!row) return Response.json({ error: "not found" }, { status: 404 });

  const { version, passport, student } = row;
  const [latest] = passport.latestVersionId
    ? await db.select().from(passportVersions).where(eq(passportVersions.id, passport.latestVersionId))
    : [];
  // what the pdf printed: the version's frozen snapshot, or the live rows for versions issued before it existed
  const skills = version.skills?.map((s) => ({ name: s.skillName, category: s.category, earnedThrough: s.earnedThrough, dateEarned: s.dateEarned }))
    ?? (version.includedRecordIds.length
      ? await db.select({ name: skillAwards.skillName, category: skillAwards.category, earnedThrough: skillAwards.earnedThrough, dateEarned: skillAwards.dateEarned })
        .from(skillAwards).where(inArray(skillAwards.recordId, version.includedRecordIds))
      : []);

  const info: VerifyInfo = {
    passportId: passport.passportId,
    holder: `${student.firstName} ${student.lastName}`,
    versionNo: version.versionNo,
    issuedAt: version.issuedAt!.toISOString(),
    skills: skills.sort((a, b) => a.dateEarned.localeCompare(b.dateEarned)),
    isLatest: latest?.id === version.id,
    latest: { versionNo: latest?.versionNo ?? version.versionNo, issuedAt: (latest?.issuedAt ?? version.issuedAt!).toISOString() },
    revoked: version.revokedAt ? { at: version.revokedAt.toISOString(), reason: version.revokeReason ?? "" } : null,
  };
  return Response.json(info, { headers: { "Cache-Control": "no-store" } });
}
