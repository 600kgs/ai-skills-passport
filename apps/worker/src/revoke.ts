// withdraws one issued version, say a skill btu confirmed by mistake. the version stays in the ledger marked
// revoked (the verify page then says so, with the reason) and its chain record is closed, so even a check that
// never reaches our server stops finding it. the skills that were the mistake are withdrawn for good; any other
// skill that only that version carried goes back to waiting, so the next issue gives the student a corrected version.
// run again on a revoked version, it only closes the chain record if that step failed before
import type { RevokeResult } from "@passport/core";
import { and, auditLog, type Db, eq, inArray, isNull, passports, passportVersions, skillAwards, sql } from "@passport/db";
import { withLedgerLock } from "@passport/ledger";

export type Closer = { close(code: string): Promise<boolean> };

export async function revokeVersion(db: Db, chain: Closer, input: { code: string; reason: string; withdraw: string[]; by: string }): Promise<RevokeResult> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("a reason is required: it is shown on the verify page");

  // 1. the ledger first: from here the verify page shows it as revoked, even if the chain step fails
  const ledger = await withLedgerLock(db, async (tx) => {
    const [version] = await tx.select().from(passportVersions).where(eq(passportVersions.verificationCode, input.code));
    if (!version || version.state !== "issued") throw new Error(`no issued version with code ${input.code}`);
    const base = { passportId: version.passportId, versionNo: version.versionNo };
    if (version.revokedAt) return { ...base, withdrawn: [] as string[], reissue: false };

    const earlier = await tx.select({ ids: passportVersions.includedRecordIds }).from(passportVersions)
      .where(and(eq(passportVersions.passportId, version.passportId), sql`${passportVersions.versionNo} < ${version.versionNo}`));
    const before = new Set(earlier.flatMap((v) => v.ids));
    const withdraw = [...new Set(input.withdraw)];
    const wrong = withdraw.filter((id) => !version.includedRecordIds.includes(id) || before.has(id));
    if (wrong.length) throw new Error(`${wrong.join(", ")} weren't first added in V${version.versionNo}; only those can be withdrawn with it`);

    await tx.execute(sql`select 1 from passports where passport_id = ${version.passportId} for update`);
    await tx.update(passportVersions).set({ revokedAt: new Date(), revokeReason: reason })
      .where(and(eq(passportVersions.id, version.id), isNull(passportVersions.revokedAt)));
    // the passport's latest is now its newest version that still stands, or none
    const [latest] = await tx.select().from(passportVersions)
      .where(and(eq(passportVersions.passportId, version.passportId), eq(passportVersions.state, "issued"), isNull(passportVersions.revokedAt)))
      .orderBy(sql`${passportVersions.versionNo} desc`).limit(1);
    await tx.update(passports).set({ latestVersionId: latest?.id ?? null }).where(eq(passports.passportId, version.passportId));
    await tx.insert(auditLog).values({
      actor: input.by, action: "version_revoked", subject: version.passportId,
      details: { versionNo: version.versionNo, code: input.code, reason, withdrawn: withdraw },
    });

    if (withdraw.length) {
      await tx.update(skillAwards).set({ state: "withdrawn", updatedAt: new Date() }).where(inArray(skillAwards.recordId, withdraw));
      await tx.insert(auditLog).values(withdraw.map((id) => ({ actor: input.by, action: "record_withdrawn", subject: id, details: { versionNo: version.versionNo, reason } })));
    }
    // skills only the revoked version carried, and not withdrawn, wait for the next issue again
    const kept = new Set(latest?.includedRecordIds ?? []);
    const back = version.includedRecordIds.filter((id) => !withdraw.includes(id) && !kept.has(id));
    if (back.length) {
      await tx.update(skillAwards).set({ state: "pending", updatedAt: new Date() })
        .where(and(inArray(skillAwards.recordId, back), eq(skillAwards.state, "applied")));
    }
    return { ...base, withdrawn: withdraw, reissue: back.length > 0 };
  });

  // 2. close the chain record; its rent goes back to the issuer
  const chainClosed = await chain.close(input.code);
  return { ...ledger, chainClosed };
}
