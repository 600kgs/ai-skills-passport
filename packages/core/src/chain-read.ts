// read-only chain lookup by verification code. runs in the browser and in node,
// so a verifier needs nothing from our server to check a record.
import { address, type Base58EncodedBytes, createSolanaRpc, getAddressDecoder, getBase64Encoder } from "@solana/kit";
import {
  deriveAttestationPda, deriveCredentialPda, deriveSchemaPda, deserializeAttestationData, fetchCredential, fetchMaybeAttestation,
  fetchSchema, getAttestationDecoder, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
} from "sas-lib";
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

// where a code's attestation lives (or will): known before the chain write, from the code alone
export async function attestationAddressFor(authority: string, code: string): Promise<string> {
  const { credential, schema } = await issuerAddresses(authority);
  const [pda] = await deriveAttestationPda({ credential, schema, nonce: getAddressDecoder().decode(await nonceFromCode(code)) });
  return pda;
}

// the keys allowed to issue right now. after a rotation this changes at once; old records keep their signer
export async function authorizedSigners(rpcUrl: string, authority: string): Promise<string[]> {
  const { credential } = await issuerAddresses(authority);
  return [...(await fetchCredential(createSolanaRpc(rpcUrl), credential)).data.authorizedSigners];
}

export type ChainAttestation = { address: string; signer: string; version: number; pdfSha256: Uint8Array };

// every attestation under this authority's credential and schema: what the chain says we issued
export async function listAttestations(rpcUrl: string, authority: string): Promise<ChainAttestation[]> {
  const rpc = createSolanaRpc(rpcUrl);
  const { credential, schema } = await issuerAddresses(authority);
  // account layout: 1 byte type, 32 nonce, 32 credential, 32 schema
  const accounts = await rpc.getProgramAccounts(SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, {
    encoding: "base64",
    filters: [
      { memcmp: { offset: BigInt(33), bytes: credential as string as Base58EncodedBytes, encoding: "base58" } },
      { memcmp: { offset: BigInt(65), bytes: schema as string as Base58EncodedBytes, encoding: "base58" } },
    ],
  }).send();
  const schemaData = (await fetchSchema(rpc, schema)).data;
  return accounts.map(({ pubkey, account }) => {
    const att = getAttestationDecoder().decode(getBase64Encoder().encode(account.data[0]));
    const data = deserializeAttestationData<AttestationData>(schemaData, Uint8Array.from(att.data));
    return { address: pubkey, signer: att.signer, version: data.version, pdfSha256: Uint8Array.from(data.pdf_sha256) };
  });
}
