// solana attestation service: write one attestation per passport version, find it by code.
// same calls as spikes/sas, with the issuer key as both signer and fee payer.
import { readFileSync } from "node:fs";
import {
  AccountRole, address, appendTransactionMessageInstructions, createKeyPairSignerFromPrivateKeyBytes, createSolanaRpc,
  createSolanaRpcSubscriptions, createTransactionMessage, getAddressDecoder, getBase64EncodedWireTransaction, getSignatureFromTransaction, pipe,
  sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners, type Address, type Instruction, type KeyPairSigner,
} from "@solana/kit";
import {
  deriveAttestationPda, deserializeAttestationData, fetchMaybeAttestation,
  fetchSchema, getCreateAttestationInstruction, serializeAttestationData, type Schema,
} from "sas-lib";
import { issuerAddresses, nonceFromCode, type AttestationData } from "@passport/core";

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

export const credentialAddresses = (authority: Address) => issuerAddresses(authority);

// system program transfer: instruction index 2 (u32 le) + lamports (u64 le)
export function transferIx(from: KeyPairSigner, to: Address, lamports: bigint): Instruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return {
    programAddress: address("11111111111111111111111111111111"),
    accounts: [{ address: from.address, role: AccountRole.WRITABLE_SIGNER, signer: from }, { address: to, role: AccountRole.WRITABLE }],
    data,
  } as Instruction;
}

// for the admin scripts: send instructions, or only simulate them (nothing is written, no fee).
// confirms by polling over http: devnet's public websocket drops connections now and then
export function txTools(rpcUrl: string) {
  const rpc = createSolanaRpc(rpcUrl);
  const build = async (ixs: Instruction[], payer: KeyPairSigner) => {
    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    return signTransactionMessageWithSigners(pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    ));
  };
  return {
    rpc,
    async send(ixs: Instruction[], payer: KeyPairSigner) {
      const tx = await build(ixs, payer);
      const signature = getSignatureFromTransaction(tx);
      await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
      // a blockhash lives ~60-90 s; past that the transaction can't land anymore
      for (const end = Date.now() + 90_000; Date.now() < end;) {
        await new Promise((r) => setTimeout(r, 1500));
        const [status] = (await rpc.getSignatureStatuses([signature]).send()).value;
        if (status?.err) throw new Error(`transaction ${signature} failed: ${JSON.stringify(status.err, (_, v) => (typeof v === "bigint" ? Number(v) : v))}`);
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      }
      throw new Error(`transaction ${signature} wasn't confirmed in 90 s; check it on the explorer before retrying`);
    },
    async simulate(ixs: Instruction[], payer: KeyPairSigner) {
      const tx = await build(ixs, payer);
      const { value } = await rpc.simulateTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", commitment: "confirmed" }).send();
      return { ok: value.err === null, err: value.err, logs: value.logs ?? [] };
    },
  };
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
