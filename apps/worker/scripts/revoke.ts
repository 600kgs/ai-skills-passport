// withdraws one issued version, say a skill btu confirmed by mistake. the version stays in the ledger
// marked revoked (the verify page then says so, with the reason), and its chain record is closed,
// so even a check that never reaches our server stops finding it. the student's other versions are untouched.
// run where the database is (on the server, in the worker container):
//   docker compose run --rm worker node --import tsx scripts/revoke.ts <code> --reason "..."         (dry run)
//   docker compose run --rm worker node --import tsx scripts/revoke.ts <code> --reason "..." --yes
// running it again on a revoked version only closes the chain record if that step failed before
import { fileURLToPath } from "node:url";
import { findRecord, normalizeCode } from "@passport/core";
import { and, auditLog, createDb, eq, isNull, passports, passportVersions, sql } from "@passport/db";
import { address } from "@solana/kit";
import { getCloseAttestationInstruction } from "sas-lib";
import { credentialAddresses, loadSigner, txTools } from "../src/chain.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
try {
  process.loadEnvFile(root(".env"));
} catch {} // in production the env comes from docker
const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v.startsWith(".") ? root(v) : v;
};
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1]?.trim() : undefined;
};

const code = normalizeCode(process.argv[2] ?? "");
const reason = arg("--reason");
const confirmed = process.argv.includes("--yes");
if (!code) throw new Error("usage: revoke.ts <verification code> --reason \"why\" [--yes]");
if (!reason) throw new Error("--reason is required: it is shown on the verify page");

const authority = env("AUTHORITY_ADDRESS");
const rpcUrl = env("SOLANA_RPC_URL");
const { db, pool } = createDb(env("DATABASE_URL"));
try {
  const [version] = await db.select().from(passportVersions).where(eq(passportVersions.verificationCode, code));
  if (!version || version.state !== "issued") throw new Error(`no issued version with code ${code}`);
  const record = await findRecord(rpcUrl, authority, code);
  console.log(`${version.passportId} V${version.versionNo} (${code}), ${version.skillCount} skills, issued ${version.issuedAt!.toISOString()}`);
  console.log(`ledger: ${version.revokedAt ? `already revoked ${version.revokedAt.toISOString()}: ${version.revokeReason}` : "valid"}`);
  console.log(`chain:  ${record ? `open at ${record.address}` : "no open record"}`);

  if (!confirmed) {
    console.log(`\ndry run. add --yes to revoke it with the reason "${reason}"`);
  } else {
    // 1. the ledger first: from here the verify page shows it as revoked, even if the chain step fails
    if (!version.revokedAt) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select 1 from passports where passport_id = ${version.passportId} for update`);
        await tx.update(passportVersions).set({ revokedAt: new Date(), revokeReason: reason })
          .where(and(eq(passportVersions.id, version.id), isNull(passportVersions.revokedAt)));
        // the passport's latest is now its newest version that still stands, or none
        const [latest] = await tx.select({ id: passportVersions.id }).from(passportVersions)
          .where(and(eq(passportVersions.passportId, version.passportId), eq(passportVersions.state, "issued"), isNull(passportVersions.revokedAt)))
          .orderBy(sql`${passportVersions.versionNo} desc`).limit(1);
        await tx.update(passports).set({ latestVersionId: latest?.id ?? null }).where(eq(passports.passportId, version.passportId));
        await tx.insert(auditLog).values({
          actor: "system", action: "version_revoked", subject: version.passportId,
          details: { versionNo: version.versionNo, code, reason },
        });
      });
      console.log("\n1. revoked in the ledger");
    } else {
      console.log("\n1. already revoked in the ledger");
    }

    // 2. close the chain record; its rent goes back to the issuer
    if (record) {
      const issuer = await loadSigner(env("ISSUER_KEY_FILE"));
      const { credential } = await credentialAddresses(address(authority));
      const sig = await txTools(rpcUrl).send([getCloseAttestationInstruction({
        payer: issuer, authority: issuer, credential, attestation: address(record.address),
      })], issuer);
      console.log(`2. closed the chain record  ${sig}`);
    } else {
      console.log("2. chain record already closed");
    }
  }
} finally {
  await pool.end();
}
