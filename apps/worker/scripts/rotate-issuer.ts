// swaps the issuer key. the authority key (on this pc, never on the server) authorizes a fresh
// issuer key and drops the old one. passports already issued keep verifying: their records stay
// under the same credential. from the swap on, the chain itself rejects the old key.
// run where secrets/authority.json is:
//   pnpm --filter @passport/worker rotate-issuer          (dry run, changes nothing)
//   pnpm --filter @passport/worker rotate-issuer --yes
// safe to run again if it stops halfway: it picks up the new key it already made.
import { randomBytes } from "node:crypto";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getAddressDecoder, type KeyPairSigner } from "@solana/kit";
import { deriveAttestationPda, fetchSchema, getChangeAuthorizedSignersInstruction, getCreateAttestationInstruction, serializeAttestationData } from "sas-lib";
import { authorizedSigners, type AttestationData } from "@passport/core";
import { credentialAddresses, loadSigner, transferIx, txTools } from "../src/chain.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
process.loadEnvFile(root(".env"));
const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};
const SOL = 1_000_000_000n;
const MIN_FEES = SOL / 20n; // ~29 issues
const TOP_UP = SOL / 5n;
const sol = (l: bigint) => `${(Number(l) / 1e9).toFixed(4)} SOL`;
const tx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const confirmed = process.argv.includes("--yes");
const rpcUrl = env("SOLANA_RPC_URL");
const { rpc, send, simulate } = txTools(rpcUrl);
const currentFile = root(env("ISSUER_KEY_FILE").replace(/^\.\//, ""));
const nextFile = currentFile.replace(/\.json$/, ".next.json");
const balance = async (k: KeyPairSigner) => (await rpc.getBalance(k.address).send()).value;

const authority = await loadSigner(root("secrets/authority.json"));
if (authority.address !== env("AUTHORITY_ADDRESS")) throw new Error(`secrets/authority.json is ${authority.address}, not AUTHORITY_ADDRESS`);
const { credential, schema } = await credentialAddresses(authority.address);
const current = existsSync(currentFile) ? await loadSigner(currentFile) : null;
let next = existsSync(nextFile) ? await loadSigner(nextFile) : null;
const before = await authorizedSigners(rpcUrl, authority.address);

console.log(`authority:          ${authority.address} (${sol(await balance(authority))})`);
console.log(`authorized now:     ${before.join(", ")}`);
console.log(`issuer key here:    ${current ? `${current.address} (${sol(await balance(current))})` : "none"}`);
if (current && !before.includes(current.address)) console.log("  note: this key isn't authorized; the server may be using a different one");
if (next) console.log(`new key from a stopped run: ${next.address}`);

if (!confirmed) {
  console.log("\ndry run. with --yes this will:");
  console.log("  1. create a new issuer key next to the current one (never printed)");
  console.log("  2. make it the only authorized signer on chain");
  console.log("  3. move the old key's SOL to it for fees");
  console.log("  4. ask the chain to simulate an attestation by the old key, which must be refused");
  process.exit(0);
}

// 1. the new key, kept on disk before anything on chain points at it
if (!next) {
  writeFileSync(nextFile, JSON.stringify({ privateKeyHex: randomBytes(32).toString("hex") }), { mode: 0o600 });
  next = await loadSigner(nextFile);
  console.log(`\n1. new issuer key: ${next.address}`);
}

// 2. one transaction: from here on only the new key can issue
if (before.length === 1 && before[0] === next.address) {
  console.log("2. already rotated on chain");
} else {
  const sig = await send([getChangeAuthorizedSignersInstruction({ payer: authority, authority, credential, signers: [next.address] })], authority);
  console.log(`2. authorized signers -> ${next.address}\n   ${tx(sig)}`);
}

// 3. fees: the old key's SOL, topped up by the authority if that isn't enough
if (current && current.address !== next.address) {
  const left = await balance(current);
  if (left > 10_000n) {
    const sig = await send([transferIx(current, next.address, left - 5_000n)], current);
    console.log(`3. moved ${sol(left - 5_000n)} from the old key\n   ${tx(sig)}`);
  }
}
if ((await balance(next)) < MIN_FEES) {
  const sig = await send([transferIx(authority, next.address, TOP_UP)], authority);
  console.log(`   topped up ${sol(TOP_UP)} from the authority\n   ${tx(sig)}`);
}

// 4. proof without writing anything: the chain refuses the old key and accepts the new one
const schemaData = (await fetchSchema(rpc, schema)).data;
const tryAttest = async (signer: KeyPairSigner) => {
  const nonce = getAddressDecoder().decode(randomBytes(32));
  const [attestation] = await deriveAttestationPda({ credential, schema, nonce });
  const data = serializeAttestationData(schemaData, { pdf_sha256: Array.from(randomBytes(32)), version: 1 } satisfies AttestationData);
  return simulate([getCreateAttestationInstruction({ payer: next!, authority: signer, credential, schema, attestation, nonce, expiry: 0, data })], next!);
};
if (current && current.address !== next.address) {
  const old = await tryAttest(current);
  const reason = old.logs.find((l) => /error|signer|fail/i.test(l)) ?? JSON.stringify(old.err);
  console.log(`4. old key tries to issue: ${old.ok ? "ACCEPTED, rotation failed" : `refused by the chain (${reason})`}`);
  if (old.ok) process.exit(1);
}
const fresh = await tryAttest(next);
console.log(`   new key tries to issue: ${fresh.ok ? "accepted" : `REFUSED (${JSON.stringify(fresh.err)})`}`);

// the new key becomes the issuer file; the old one is kept, dated, for the record
if (current && current.address !== next.address) renameSync(currentFile, currentFile.replace(/\.json$/, `.old-${new Date().toISOString().slice(0, 10)}-${current.address.slice(0, 6)}.json`));
renameSync(nextFile, currentFile);
console.log(`\ndone. ${env("ISSUER_KEY_FILE")} is now ${next.address} (balance ${sol(await balance(next))}).`);
console.log("until the server has this key, its issue jobs fail and retry on their own. put it there next.");

