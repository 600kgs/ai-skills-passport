// devnet test of the passport flow on the solana attestation service:
// btu credential -> schema -> attestation per passport version, found by its
// verification code alone, then a signer rotation that must not break old proofs.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  airdropFactory,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressDecoder,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  deriveAttestationPda,
  deriveCredentialPda,
  deriveSchemaPda,
  deserializeAttestationData,
  fetchAttestation,
  fetchCredential,
  fetchMaybeAttestation,
  fetchMaybeCredential,
  fetchMaybeSchema,
  fetchSchema,
  getChangeAuthorizedSignersInstruction,
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  serializeAttestationData,
} from "sas-lib";

const RPC_URL = "https://api.devnet.solana.com";
const WS_URL = "wss://api.devnet.solana.com";
const CREDENTIAL_NAME = "BTU-AI-Passport-Test";
const SCHEMA_NAME = "passport-version";
const SCHEMA_VERSION = 1;
const LAMPORTS_PER_SOL = 1_000_000_000n;

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

const explorer = (kind: "address" | "tx", id: string) =>
  `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
const sol = (l: bigint) => `${Number(l) / Number(LAMPORTS_PER_SOL)} SOL`;
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

// keys live in .keys/ (gitignored). devnet only, but same habit as production
async function loadOrCreateSigner(name: string): Promise<KeyPairSigner> {
  mkdirSync(".keys", { recursive: true });
  const path = `.keys/${name}.json`;
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ privateKeyHex: randomBytes(32).toString("hex") }));
  }
  const { privateKeyHex } = JSON.parse(readFileSync(path, "utf8"));
  return createKeyPairSignerFromPrivateKeyBytes(Buffer.from(privateKeyHex, "hex"));
}

async function send(instructions: Instruction[], feePayer: KeyPairSigner): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
  return getSignatureFromTransaction(tx);
}

// the verification code printed on the pdf maps to one attestation address.
// anyone holding the code can find the record without asking our server.
function nonceFromCode(code: string): Address {
  return getAddressDecoder().decode(sha256(`btu-passport:v1:${code}`));
}

async function ensureFunded(signer: KeyPairSigner) {
  const { value: balance } = await rpc.getBalance(signer.address).send();
  console.log(`authority balance: ${sol(balance)}`);
  if (balance >= LAMPORTS_PER_SOL / 20n) return;
  try {
    await airdropFactory({ rpc, rpcSubscriptions })({
      recipientAddress: signer.address,
      lamports: lamports(LAMPORTS_PER_SOL),
      commitment: "confirmed",
    });
    console.log("airdropped 1 devnet SOL");
  } catch (e) {
    console.error(`\nairdrop failed (${(e as Error).message}).`);
    console.error(`fund this address at https://faucet.solana.com (devnet), then run again:\n  ${signer.address}\n`);
    process.exit(1);
  }
}

async function main() {
  const authority = await loadOrCreateSigner("authority");
  const issuerA = await loadOrCreateSigner("issuer-a");
  const issuerB = await loadOrCreateSigner("issuer-b");
  console.log(`authority: ${authority.address}\nissuer A:  ${issuerA.address}\nissuer B:  ${issuerB.address}\n`);
  await ensureFunded(authority);

  // 1. credential = btu as issuer, with issuer A as the only allowed signer
  const [credential] = await deriveCredentialPda({ authority: authority.address, name: CREDENTIAL_NAME });
  if (!(await fetchMaybeCredential(rpc, credential)).exists) {
    const sig = await send(
      [getCreateCredentialInstruction({
        payer: authority, authority, credential,
        name: CREDENTIAL_NAME, signers: [issuerA.address],
      })],
      authority,
    );
    console.log(`credential created: ${explorer("tx", sig)}`);
  } else {
    // a previous run may have rotated to B; reset so the test starts clean
    const cred = await fetchCredential(rpc, credential);
    if (cred.data.authorizedSigners.join() !== issuerA.address) {
      await send([getChangeAuthorizedSignersInstruction({
        payer: authority, authority, credential, signers: [issuerA.address],
      })], authority);
      console.log("credential signers reset to issuer A");
    }
  }
  console.log(`credential: ${explorer("address", credential)}`);

  // 2. schema = what every passport-version attestation contains
  const [schemaPda] = await deriveSchemaPda({ credential, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  if (!(await fetchMaybeSchema(rpc, schemaPda)).exists) {
    const sig = await send(
      [getCreateSchemaInstruction({
        payer: authority, authority, credential, schema: schemaPda,
        name: SCHEMA_NAME,
        description: "sha256 of an officially issued passport pdf and its version number",
        layout: new Uint8Array([13, 1]), // vec<u8>, u16
        fieldNames: ["pdf_sha256", "version"],
      })],
      authority,
    );
    console.log(`schema created: ${explorer("tx", sig)}`);
  }
  const schema = await fetchSchema(rpc, schemaPda);
  console.log(`schema: ${explorer("address", schemaPda)}\n`);

  // 3. attestation for one passport version, signed by issuer A
  const code = randomBytes(5).toString("hex").toUpperCase(); // stands in for the printed code
  const pdfBytes = new TextEncoder().encode(`fake passport pdf BTU-AI-000125 v1 ${code}`);
  const pdfHash = sha256(pdfBytes);
  const [attestation] = await deriveAttestationPda({ credential, schema: schemaPda, nonce: nonceFromCode(code) });
  const { value: before } = await rpc.getBalance(authority.address).send();
  const attSig = await send(
    [getCreateAttestationInstruction({
      payer: authority, authority: issuerA, credential, schema: schemaPda, attestation,
      nonce: nonceFromCode(code),
      data: serializeAttestationData(schema.data, { pdf_sha256: Array.from(pdfHash), version: 1 }),
      expiry: 0,
    })],
    authority,
  );
  const { value: after } = await rpc.getBalance(authority.address).send();
  console.log(`attestation for code ${code}: ${explorer("address", attestation)}`);
  console.log(`  tx: ${explorer("tx", attSig)}`);

  // 4. verify from the code alone, like the public verify page will
  const verify = async (label: string, presented: Uint8Array) => {
    const [addr] = await deriveAttestationPda({ credential, schema: schemaPda, nonce: nonceFromCode(code) });
    const found = await fetchMaybeAttestation(rpc, addr);
    if (!found.exists) return console.log(`  ${label}: UNKNOWN CODE`);
    const ok = found.data.credential === credential && found.data.schema === schemaPda;
    const d = deserializeAttestationData<{ pdf_sha256: number[]; version: number }>(schema.data, Uint8Array.from(found.data.data));
    const match = Buffer.from(d.pdf_sha256).equals(sha256(presented));
    console.log(`  ${label}: issuer ${ok ? "BTU credential" : "NOT BTU"}, signer ${found.data.signer}, v${d.version}, file ${match ? "AUTHENTIC" : "MODIFIED"}`);
  };
  console.log("\nverify:");
  await verify("original pdf", pdfBytes);
  await verify("tampered pdf", new TextEncoder().encode(`fake passport pdf BTU-AI-000125 v1 ${code}!`));

  // 5. cost: the account's rent deposit (refundable on close) plus the fee
  const acct = await rpc.getAccountInfo(attestation, { encoding: "base64" }).send();
  const rent = acct.value!.lamports;
  console.log(`\ncost per attestation: rent ${sol(rent)} (locked, refundable) + fee ${sol(before - after - rent)}`);
  console.log(`account size: ${acct.value!.space} bytes`);

  // 6. rotation: authority swaps issuer A for B (the "leaked key" drill)
  const rotSig = await send(
    [getChangeAuthorizedSignersInstruction({ payer: authority, authority, credential, signers: [issuerB.address] })],
    authority,
  );
  console.log(`\nrotated signers A -> B: ${explorer("tx", rotSig)}`);
  await verify("old attestation after rotation", pdfBytes);

  try {
    const code2 = randomBytes(5).toString("hex");
    const [att2] = await deriveAttestationPda({ credential, schema: schemaPda, nonce: nonceFromCode(code2) });
    await send([getCreateAttestationInstruction({
      payer: authority, authority: issuerA, credential, schema: schemaPda, attestation: att2,
      nonce: nonceFromCode(code2),
      data: serializeAttestationData(schema.data, { pdf_sha256: Array.from(pdfHash), version: 2 }),
      expiry: 0,
    })], authority);
    console.log("  revoked issuer A could still attest: ROTATION FAILED");
  } catch (e) {
    const ctx = (e as { context?: { logs?: string[] }; cause?: { message?: string } });
    const reason = [ctx.cause?.message, ...(ctx.context?.logs ?? []).filter((l) => /error|signer|fail/i.test(l))].filter(Boolean).join(" | ");
    console.log(`  revoked issuer A tried to attest: REJECTED (good) -> ${reason}`);
  }

  const code3 = randomBytes(5).toString("hex");
  const [att3] = await deriveAttestationPda({ credential, schema: schemaPda, nonce: nonceFromCode(code3) });
  await send([getCreateAttestationInstruction({
    payer: authority, authority: issuerB, credential, schema: schemaPda, attestation: att3,
    nonce: nonceFromCode(code3),
    data: serializeAttestationData(schema.data, { pdf_sha256: Array.from(pdfHash), version: 2 }),
    expiry: 0,
  })], authority);
  const a3 = await fetchAttestation(rpc, att3);
  console.log(`  new issuer B attests: OK (${explorer("address", att3)}, signer ${a3.data.signer})`);
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
