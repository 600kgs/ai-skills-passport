// what the server adds to the chain check: whether this version is the latest,
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
  skills: { name: string; category: string }[];
  isLatest: boolean;
  latest: { versionNo: number; issuedAt: string };
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
  const skills = version.includedRecordIds.length
    ? await db.select({ name: skillAwards.skillName, category: skillAwards.category, date: skillAwards.dateEarned })
      .from(skillAwards).where(inArray(skillAwards.recordId, version.includedRecordIds))
    : [];

  const info: VerifyInfo = {
    passportId: passport.passportId,
    holder: `${student.firstName} ${student.lastName}`,
    versionNo: version.versionNo,
    issuedAt: version.issuedAt!.toISOString(),
    skills: skills.sort((a, b) => a.date.localeCompare(b.date)).map(({ name, category }) => ({ name, category })),
    isLatest: latest?.id === version.id,
    latest: { versionNo: latest?.versionNo ?? version.versionNo, issuedAt: (latest?.issuedAt ?? version.issuedAt!).toISOString() },
  };
  return Response.json(info, { headers: { "Cache-Control": "no-store" } });
}
