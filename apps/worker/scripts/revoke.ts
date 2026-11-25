// withdraws one issued version, say a skill btu confirmed by mistake. the version stays in the ledger
// marked revoked (the verify page then says so, with the reason), and its chain record is closed,
// so even a check that never reaches our server stops finding it. the student's other versions are untouched.
// run where the database is (on the server, in the worker container):
//   docker compose -f docker-compose.prod.yml run --rm worker node --import tsx scripts/revoke.ts <code> --reason "..."         (dry run)
//   docker compose -f docker-compose.prod.yml run --rm worker node --import tsx scripts/revoke.ts <code> --reason "..." --yes
// --withdraw REC-0123,REC-0124 also withdraws the skills that were the mistake (only ones first added in that version);
// a superadmin can do the same from the passport's admin page
// running it again on a revoked version only closes the chain record if that step failed before
import { fileURLToPath } from "node:url";
import { findRecord, normalizeCode } from "@passport/core";
import { createDb, eq, passportVersions } from "@passport/db";
import { solanaChain } from "../src/chain.ts";
import { revokeVersion } from "../src/revoke.ts";

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
const withdraw = (arg("--withdraw") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const { db, pool } = createDb(env("DATABASE_URL"));
try {
  const [version] = await db.select().from(passportVersions).where(eq(passportVersions.verificationCode, code));
  if (!version || version.state !== "issued") throw new Error(`no issued version with code ${code}`);
  const record = await findRecord(rpcUrl, authority, code);
  console.log(`${version.passportId} V${version.versionNo} (${code}), ${version.skillCount} skills, issued ${version.issuedAt!.toISOString()}`);
  console.log(`ledger: ${version.revokedAt ? `already revoked ${version.revokedAt.toISOString()}: ${version.revokeReason}` : "valid"}`);
  console.log(`chain:  ${record ? `open at ${record.address}` : "no open record"}`);
  if (withdraw.length) console.log(`withdraw: ${withdraw.join(", ")}`);

  if (!confirmed) {
    console.log(`
dry run. add --yes to revoke it with the reason "${reason}"`);
  } else {
    const chain = await solanaChain({ rpcUrl, wsUrl: env("SOLANA_WS_URL"), issuerKeyFile: env("ISSUER_KEY_FILE"), authorityAddress: authority });
    const r = await revokeVersion(db, chain, { code, reason, withdraw, by: "script" });
    console.log(`
revoked in the ledger; chain record ${r.chainClosed ? "closed" : "already closed"}`);
    if (r.withdrawn.length) console.log(`withdrawn: ${r.withdrawn.join(", ")}`);
    // the worker's sweep issues the corrected version within a minute
    if (r.reissue) console.log("the remaining skills go back to waiting; the worker issues a corrected version");
  }
} finally {
  await pool.end();
}
