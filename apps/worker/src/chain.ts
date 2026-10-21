// solana attestation service: write one attestation per passport version, find it by code.
// same calls as spikes/sas, with the issuer key as both signer and fee payer.
import { readFileSync } from "node:fs";
import {
  address, appendTransactionMessageInstructions, createKeyPairSignerFromPrivateKeyBytes, createSolanaRpc,
  createSolanaRpcSubscriptions, createTransactionMessage, getAddressDecoder, getSignatureFromTransaction, pipe,
  sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners, type Address, type KeyPairSigner,
} from "@solana/kit";
import {
  deriveAttestationPda, deriveCredentialPda, deriveSchemaPda, deserializeAttestationData, fetchMaybeAttestation,
  fetchSchema, getCreateAttestationInstruction, serializeAttestationData, type Schema,
} from "sas-lib";
import { CREDENTIAL_NAME, nonceFromCode, SCHEMA_NAME, SCHEMA_VERSION, type AttestationData } from "@passport/core";

export type Anchored = { address: string; signature: string; signer: string };
export type Found = Anchored & { pdfSha256: Uint8Array; version: number };

export interface Chain {
  attest(input: { code: string; pdfSha256: Uint8Array; version: number }): Promise<Anchored>;
  find(code: string): Promise<Found | null>;
}

export async function loadSigner(keyFile: string): Promise<KeyPairSigner> {
  const { privateKeyHex } = JSON.parse(readFileSync(keyFile, "utf8")) as { privateKeyHex: string };
  return createKeyPairSignerFromPrivateKeyBytes(Buffer.from(privateKeyHex, "hex"));
}

export async function credentialAddresses(authority: Address) {
  const [credential] = await deriveCredentialPda({ authority, name: CREDENTIAL_NAME });
  const [schema] = await deriveSchemaPda({ credential, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  return { credential, schema };
}

export async function solanaChain(cfg: { rpcUrl: string; wsUrl: string; issuerKeyFile: string; authorityAddress: string }): Promise<Chain> {
  const rpc = createSolanaRpc(cfg.rpcUrl);
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: createSolanaRpcSubscriptions(cfg.wsUrl) });
  const issuer = await loadSigner(cfg.issuerKeyFile);
  const { credential, schema } = await credentialAddresses(address(cfg.authorityAddress));
  let schemaData: Schema | undefined;
  const getSchema = async () => (schemaData ??= (await fetchSchema(rpc, schema)).data);
  const pdaFor = async (code: string) => {
    const nonce = getAddressDecoder().decode(await nonceFromCode(code));
    const [pda] = await deriveAttestationPda({ credential, schema, nonce });
    return { nonce, pda };
  };

  return {
    async attest({ code, pdfSha256, version }) {
      const { nonce, pda } = await pdaFor(code);
      const ix = getCreateAttestationInstruction({
        payer: issuer, authority: issuer, credential, schema, attestation: pda, nonce, expiry: 0,
        data: serializeAttestationData(await getSchema(), { pdf_sha256: Array.from(pdfSha256), version } satisfies AttestationData),
      });
      const { value: blockhash } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(issuer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstructions([ix], m),
      );
      const tx = await signTransactionMessageWithSigners(message);
      await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
      return { address: pda, signature: getSignatureFromTransaction(tx), signer: issuer.address };
    },

    async find(code) {
      const { pda } = await pdaFor(code);
      const acct = await fetchMaybeAttestation(rpc, pda, { commitment: "confirmed" });
      if (!acct.exists || acct.data.credential !== credential || acct.data.schema !== schema) return null;
      const data = deserializeAttestationData<AttestationData>(await getSchema(), Uint8Array.from(acct.data.data));
      // the creating transaction is the account's oldest signature
      const sigs = await rpc.getSignaturesForAddress(pda, { limit: 1000, commitment: "confirmed" }).send();
      return {
        address: pda, signer: acct.data.signer, signature: sigs.at(-1)?.signature ?? "",
        pdfSha256: Uint8Array.from(data.pdf_sha256), version: data.version,
      };
    },
  };
}
