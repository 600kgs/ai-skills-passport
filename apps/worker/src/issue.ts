// issues the next version of one passport: prepare -> render -> anchor -> commit.
// every step is resumable. an unfinished version is picked up again with the same
// code and the same stored pdf, and the latest valid version only moves at commit.
import { equalBytes, newVerificationCode, sha256, toHex, type Category } from "@passport/core";
import { and, auditLog, eq, inArray, passports, passportVersions, skillAwards, sql, students, type Db } from "@passport/db";
import type { Chain } from "./chain.ts";
import type { Renderer } from "./pdf/render.ts";
import type { PdfStore } from "./storage.ts";

export type IssueDeps = { render: Renderer; chain: Chain; store: PdfStore; publicBaseUrl: string };
export type IssueResult =
  | { status: "nothing-pending" }
  | { status: "issued"; passportId: string; versionNo: number; code: string; attestation: string; signature: string };

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));

export async function issuePassport(db: Db, deps: IssueDeps, passportId: string): Promise<IssueResult> {
  // 1. prepare: resume an unfinished version, or open the next one for pending skills
  const prep = await db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from passports where passport_id = ${passportId} for update`);
    const [passport] = await tx.select().from(passports).where(eq(passports.passportId, passportId));
    if (!passport) throw new Error(`no passport ${passportId}`);
    const [student] = await tx.select().from(students).where(eq(students.studentId, passport.studentId));

    const [open] = await tx.select().from(passportVersions)
      .where(and(eq(passportVersions.passportId, passportId), inArray(passportVersions.state, ["rendering", "anchoring", "failed"])))
      .orderBy(sql`${passportVersions.versionNo} desc`).limit(1);
    if (open) return { passport, student: student!, version: open };

    const awards = await tx.select().from(skillAwards).where(eq(skillAwards.studentId, passport.studentId));
    const pending = awards.filter((a) => a.state === "pending");
    if (!pending.length) return null;
    const included = awards.filter((a) => a.state === "pending" || a.state === "applied").map((a) => a.recordId);
    const [{ last }] = (await tx.execute<{ last: number }>(
      sql`select coalesce(max(version_no), 0)::int as last from passport_versions where passport_id = ${passportId}`)).rows as [{ last: number }];

    const [version] = await tx.insert(passportVersions).values({
      passportId, versionNo: last + 1, verificationCode: newVerificationCode(), state: "rendering",
      skillCount: included.length, includedRecordIds: included,
    }).returning();
    return { passport, student: student!, version: version! };
  });
  if (!prep) return { status: "nothing-pending" };
  const { passport, student } = prep;
  let version = prep.version;
  const code = version.verificationCode;

  try {
    // 2. render once. a stored pdf from an earlier attempt is reused, never re-rendered
    let pdf = version.pdfSha256 ? await deps.store.get(version.pdfSha256) : null;
    if (!pdf) {
      const awards = await db.select().from(skillAwards).where(inArray(skillAwards.recordId, version.includedRecordIds));
      pdf = await deps.render({
        passportId, firstName: student.firstName, lastName: student.lastName, firstIssued: passport.firstIssued,
        version: version.versionNo, verificationCode: code, verifyUrl: `${deps.publicBaseUrl}/v/${code}`,
        skills: awards.sort((a, b) => a.dateEarned.localeCompare(b.dateEarned) || a.recordId.localeCompare(b.recordId)).map((a) => ({
          name: a.skillName, category: a.category as Category, description: a.description,
          earnedThrough: a.earnedThrough, dateEarned: a.dateEarned,
        })),
      });
      const hex = toHex(await sha256(pdf));
      const pdfPath = await deps.store.put(hex, pdf);
      [version] = await db.update(passportVersions).set({ pdfSha256: hex, pdfPath, state: "anchoring", error: null })
        .where(eq(passportVersions.id, version.id)).returning() as [typeof version];
    }
    const hash = fromHex(version.pdfSha256!);

    // 3. anchor. if a crash hit right after the chain write, the attestation is already there
    const existing = await deps.chain.find(code);
    if (existing && !equalBytes(existing.pdfSha256, hash)) {
      throw new Error(`attestation for ${code} already exists with a different pdf hash`);
    }
    const anchored = existing ?? (await deps.chain.attest({ code, pdfSha256: hash, version: version.versionNo }));

    // 4. commit: only now does this version become the latest valid one
    await db.transaction(async (tx) => {
      await tx.update(passportVersions).set({
        state: "issued", issuedAt: new Date(), error: null,
        attestationAddress: anchored.address, txSignature: anchored.signature, signer: anchored.signer,
      }).where(eq(passportVersions.id, version.id));
      // never move "latest" backwards if versions ever finish out of order
      await tx.execute(sql`update passports set latest_version_id = ${version.id}
        where passport_id = ${passportId} and (latest_version_id is null or
          (select version_no from passport_versions where id = latest_version_id) < ${version.versionNo})`);
      await tx.update(skillAwards).set({ state: "applied", appliedInVersionId: version.id, updatedAt: new Date() })
        .where(and(inArray(skillAwards.recordId, version.includedRecordIds), eq(skillAwards.state, "pending")));
      await tx.insert(auditLog).values({
        actor: "system", action: "version_issued", subject: passportId,
        details: { versionNo: version.versionNo, code, attestation: anchored.address, signature: anchored.signature },
      });
    });
    return { status: "issued", passportId, versionNo: version.versionNo, code, attestation: anchored.address, signature: anchored.signature };
  } catch (e) {
    await db.update(passportVersions).set({ state: "failed", error: (e as Error).message.slice(0, 500) })
      .where(eq(passportVersions.id, version.id));
    throw e; // the queue retries with backoff, and the next attempt resumes this version
  }
}
