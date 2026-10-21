// verifies a passport pdf the way a third party would: the file, its code, and the public chain.
// no database, no keys, no trust in our server.
//   pnpm --filter @passport/worker verify <file.pdf> <code> [authority-address]
import { readFileSync } from "node:fs";
import { findRecord, normalizeCode, sha256, toHex, verdict } from "@passport/core";

const [file, rawCode, authorityArg] = process.argv.slice(2);
const authority = authorityArg ?? process.env.AUTHORITY_ADDRESS ?? "AhSRd9UQgbAYhg7FhYWvPUQCwzr4o7qtuQ9DWNSfzwnE";
const code = normalizeCode(rawCode ?? "");
if (!file || !code) {
  console.error("usage: verify <file.pdf> <verification code> [authority address]");
  process.exit(2);
}

const record = await findRecord(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", authority, code);
const fileHash = await sha256(new Uint8Array(readFileSync(file)));
// the cli only knows the chain, so "latest" is left to the web page
const v = verdict({ record, latest: null, fileHash });
if (!record) {
  console.log(`UNKNOWN CODE: no BTU attestation for ${code}`);
} else {
  console.log(`issuer:  BTU credential ${record.credential} (authority ${authority}), signed by ${record.signer}`);
  console.log(`version: V${record.version}`);
  console.log(`file:    ${v.file === "authentic" ? "AUTHENTIC" : "MODIFIED"} (sha256 ${toHex(fileHash).slice(0, 16)}...)`);
  console.log(`proof:   https://explorer.solana.com/address/${record.address}?cluster=devnet`);
}
process.exitCode = v.file === "authentic" ? 0 : 1;
