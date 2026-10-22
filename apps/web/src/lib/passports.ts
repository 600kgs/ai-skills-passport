import "server-only";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { sameEmail, sha256, toHex } from "@passport/core";
import { and, eq, passports, passportVersions, sql, students } from "@passport/db";
import { getDb } from "@/lib/db";

export type MyPassport = {
  passportId: string;
  holder: string;
  versions: { versionNo: number; code: string; issuedAt: Date; skillCount: number; isLatest: boolean }[];
};

// the passport whose sheet email is this account's email, with its issued versions newest first
export async function passportForEmail(email: string): Promise<MyPassport | null> {
  const db = getDb();
  const [row] = await db.select({ passport: passports, student: students })
    .from(students)
    .innerJoin(passports, eq(passports.studentId, students.studentId))
    .where(sql`lower(${students.email}) = ${email.trim().toLowerCase()}`);
  if (!row) return null;

  const versions = await db.select().from(passportVersions)
    .where(and(eq(passportVersions.passportId, row.passport.passportId), eq(passportVersions.state, "issued")));
  return {
    passportId: row.passport.passportId,
    holder: `${row.student.firstName} ${row.student.lastName}`,
    versions: versions
      .sort((a, b) => b.versionNo - a.versionNo)
      .map((v) => ({
        versionNo: v.versionNo, code: v.verificationCode, issuedAt: v.issuedAt!, skillCount: v.skillCount,
        isLatest: v.id === row.passport.latestVersionId,
      })),
  };
}

// next dev runs inside apps/web, while relative paths in .env are written from the repo root
const storageDir = () => {
  const dir = process.env.STORAGE_DIR ?? "./storage";
  return isAbsolute(dir) ? dir : resolve(/*turbopackIgnore: true*/ process.cwd(), "../..", dir);
};

// the stored pdf for a code, only if it belongs to this email. null covers "no such code"
// and "not yours" alike, so codes can't be probed for ownership
export async function pdfFor(code: string, email: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; name: string } | null> {
  const [row] = await getDb().select({ version: passportVersions, student: students })
    .from(passportVersions)
    .innerJoin(passports, eq(passports.passportId, passportVersions.passportId))
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .where(and(eq(passportVersions.verificationCode, code), eq(passportVersions.state, "issued")));
  if (!row || !sameEmail(row.student.email, email) || !row.version.pdfSha256) return null;

  // stored under its own hash; serve it only if it still is that file, byte for byte
  const bytes = new Uint8Array(await readFile(join(storageDir(), "pdfs", `${row.version.pdfSha256}.pdf`)));
  if (toHex(await sha256(bytes)) !== row.version.pdfSha256) throw new Error(`stored pdf for ${code} doesn't match its hash`);
  return { bytes, name: `${row.version.passportId}-V${row.version.versionNo}.pdf` };
}
