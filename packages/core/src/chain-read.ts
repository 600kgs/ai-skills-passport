// read-only chain lookup by verification code. runs in the browser and in node,
// so a verifier needs nothing from our server to check a record.
import { address, createSolanaRpc, getAddressDecoder } from "@solana/kit";
import { deriveAttestationPda, deriveCredentialPda, deriveSchemaPda, deserializeAttestationData, fetchMaybeAttestation, fetchSchema } from "sas-lib";
import { CREDENTIAL_NAME, nonceFromCode, SCHEMA_NAME, SCHEMA_VERSION, type AttestationData } from "./chain.ts";

export type ChainRecord = { address: string; credential: string; signer: string; pdfSha256: Uint8Array; version: number };

export async function issuerAddresses(authority: string) {
  const [credential] = await deriveCredentialPda({ authority: address(authority), name: CREDENTIAL_NAME });
  const [schema] = await deriveSchemaPda({ credential, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  return { credential, schema };
}

// null means no attestation for this code under this authority's credential
export async function findRecord(rpcUrl: string, authority: string, code: string): Promise<ChainRecord | null> {
  const rpc = createSolanaRpc(rpcUrl);
  const { credential, schema } = await issuerAddresses(authority);
  const nonce = getAddressDecoder().decode(await nonceFromCode(code));
  const [pda] = await deriveAttestationPda({ credential, schema, nonce });
  const att = await fetchMaybeAttestation(rpc, pda, { commitment: "confirmed" });
  if (!att.exists || att.data.credential !== credential || att.data.schema !== schema) return null;
  const data = deserializeAttestationData<AttestationData>((await fetchSchema(rpc, schema)).data, Uint8Array.from(att.data.data));
  return { address: pda, credential, signer: att.data.signer, pdfSha256: Uint8Array.from(data.pdf_sha256), version: data.version };
}
