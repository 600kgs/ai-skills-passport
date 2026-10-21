// what goes on solana for each passport version (schema tested in spikes/sas)
import { sha256 } from "./hash.ts";

export const CREDENTIAL_NAME = "BTU-AI-Passport";
export const SCHEMA_NAME = "passport-version";
export const SCHEMA_VERSION = 1;
export const SCHEMA_LAYOUT = new Uint8Array([13, 1]); // vec<u8>, u16
export const SCHEMA_FIELDS = ["pdf_sha256", "version"] as const;

export type AttestationData = { pdf_sha256: number[]; version: number };

// the attestation address is derived from this nonce, so a verification code
// alone is enough to find the record on chain, no server lookup needed
export async function nonceFromCode(normalizedCode: string): Promise<Uint8Array> {
  return sha256(`btu-passport:v1:${normalizedCode}`);
}
