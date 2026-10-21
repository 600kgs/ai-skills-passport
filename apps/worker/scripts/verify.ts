// verifies a passport pdf the way a third party would: the file, its code, and the public chain.
// no database, no keys, no trust in our server.
//   pnpm --filter @passport/worker verify <file.pdf> <code> [authority-address]
import { readFileSync } from "node:fs";
import { address, createSolanaRpc, getAddressDecoder } from "@solana/kit";
import { deriveAttestationPda, deserializeAttestationData, fetchMaybeAttestation, fetchSchema } from "sas-lib";
import { equalBytes, nonceFromCode, normalizeCode, sha256, toHex, type AttestationData } from "@passport/core";
import { credentialAddresses } from "../src/chain.ts";

const [file, rawCode, authorityArg] = process.argv.slice(2);
const authority = authorityArg ?? process.env.AUTHORITY_ADDRESS ?? "AhSRd9UQgbAYhg7FhYWvPUQCwzr4o7qtuQ9DWNSfzwnE";
const code = normalizeCode(rawCode ?? "");
if (!file || !code) {
  console.error("usage: verify <file.pdf> <verification code> [authority address]");
  process.exit(2);
}

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com");
const { credential, schema } = await credentialAddresses(address(authority));
const nonce = getAddressDecoder().decode(await nonceFromCode(code));
const [pda] = await deriveAttestationPda({ credential, schema, nonce });
const att = await fetchMaybeAttestation(rpc, pda);

if (!att.exists || att.data.credential !== credential) {
  console.log(`UNKNOWN CODE: no BTU attestation for ${code}`);
  process.exitCode = 1;
} else {
  const data = deserializeAttestationData<AttestationData>((await fetchSchema(rpc, schema)).data, Uint8Array.from(att.data.data));
  const fileHash = await sha256(new Uint8Array(readFileSync(file)));
  const ok = equalBytes(fileHash, Uint8Array.from(data.pdf_sha256));
  console.log(`issuer:  BTU credential ${credential} (authority ${authority}), signed by ${att.data.signer}`);
  console.log(`version: V${data.version}`);
  console.log(`file:    ${ok ? "AUTHENTIC" : "MODIFIED"} (sha256 ${toHex(fileHash).slice(0, 16)}...)`);
  console.log(`proof:   https://explorer.solana.com/address/${pda}?cluster=devnet`);
  process.exitCode = ok ? 0 : 1;
}
