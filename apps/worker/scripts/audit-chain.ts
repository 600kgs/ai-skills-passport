// compares the chain with the ledger. every attestation under our credential should be a version
// we issued; anything else was written by someone holding an issuer key, or is left over from a
// full reissue. run where the database is (on the server, in the worker container):
//   docker compose run --rm worker node --import tsx scripts/audit-chain.ts           (report only)
//   docker compose run --rm worker node --import tsx scripts/audit-chain.ts --close   (closes the foreign ones)
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { attestationAddressFor, authorizedSigners, listAttestations, toHex } from "@passport/core";
import { createDb, passportVersions } from "@passport/db";
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
const CLOSE_PER_TX = 5;

const authority = env("AUTHORITY_ADDRESS");
const rpcUrl = env("SOLANA_RPC_URL");
const { db, pool } = createDb(env("DATABASE_URL"));
const versions = await db.select({
  code: passportVersions.verificationCode, passportId: passportVersions.passportId, versionNo: passportVersions.versionNo, state: passportVersions.state,
  revokedAt: passportVersions.revokedAt,
}).from(passportVersions);
await pool.end();

// every code in the ledger, in any state: an issue in progress has its address before its chain write lands
const known = new Map(await Promise.all(versions.map(async (v) => [await attestationAddressFor(authority, v.code), v] as const)));
const onChain = await listAttestations(rpcUrl, authority);
const chainAddresses = new Set(onChain.map((a) => a.address));
const unknown = onChain.filter((a) => !known.has(a.address));
// a revoked version's record is closed on purpose, so it is only off when it is still open
const missing = [...known].filter(([addr, v]) => v.state === "issued" && !v.revokedAt && !chainAddresses.has(addr));
const revokedOpen = onChain.filter((a) => known.get(a.address)?.revokedAt);
// a record we hold the pdf for is ours even if the ledger lost it (say, restored from an older backup).
// those are never closed: closing one would turn a real passport into "unknown code" for good
const pdfDir = join(env("STORAGE_DIR"), "pdfs");
const weHoldPdf = (a: (typeof onChain)[number]) => existsSync(join(pdfDir, `${toHex(a.pdfSha256)}.pdf`));
const ours = unknown.filter(weHoldPdf);
const foreign = unknown.filter((a) => !weHoldPdf(a));

const bySigner = (list: typeof onChain) => {
  const n = new Map<string, number>();
  for (const a of list) n.set(a.signer, (n.get(a.signer) ?? 0) + 1);
  return [...n].map(([s, c]) => `${s} (${c})`).join(", ");
};
console.log(`ledger:   ${versions.length} versions, ${versions.filter((v) => v.state === "issued").length} issued, ${versions.filter((v) => v.revokedAt).length} of them revoked`);
console.log(`on chain: ${onChain.length} attestations, signed by ${bySigner(onChain) || "nobody"}`);
console.log(`authorized now: ${(await authorizedSigners(rpcUrl, authority)).join(", ")}`);
const list = (items: typeof onChain) => {
  for (const a of items.slice(0, 20)) console.log(`  ${a.address}  V${a.version}  signer ${a.signer}`);
  if (items.length > 20) console.log(`  ...and ${items.length - 20} more`);
};
console.log(`\nnot in the ledger, no pdf of ours (foreign or leftover): ${foreign.length}${foreign.length ? `, signed by ${bySigner(foreign)}` : ""}`);
list(foreign);
console.log(`not in the ledger, but we hold its pdf (ours; restore the ledger, never close): ${ours.length}`);
list(ours);
console.log(`issued but missing on chain: ${missing.length}`);
for (const [addr, v] of missing) console.log(`  ${v.passportId} V${v.versionNo} (${v.code}) should be at ${addr}`);
console.log(`revoked but still open on chain (closed by --close, or rerun revoke.ts): ${revokedOpen.length}`);
list(revokedOpen);

const toClose = [...foreign, ...revokedOpen];
let closed = 0;
if (process.argv.includes("--close") && toClose.length) {
  // an empty ledger would make every real record look unknown
  if (!versions.some((v) => v.state === "issued")) throw new Error("refusing: the ledger has no issued versions");
  const issuer = await loadSigner(env("ISSUER_KEY_FILE"));
  const { credential } = await credentialAddresses(address(authority));
  const { send } = txTools(rpcUrl);
  console.log(`\nclosing ${toClose.length} with ${issuer.address}; their rent goes back to it`);
  for (let i = 0; i < toClose.length; i += CLOSE_PER_TX) {
    const batch = toClose.slice(i, i + CLOSE_PER_TX);
    const sig = await send(batch.map((a) => getCloseAttestationInstruction({ payer: issuer, authority: issuer, credential, attestation: address(a.address) })), issuer);
    closed += batch.length;
    console.log(`  closed ${closed}/${toClose.length}  ${sig}`);
  }
}
// non-zero while something is still off, so it can gate a deploy or a cron alert
process.exit(toClose.length - closed || ours.length || missing.length ? 1 : 0);
