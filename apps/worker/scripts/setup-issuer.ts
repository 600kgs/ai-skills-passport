// one-time devnet setup: keys, the btu credential and schema, and fee money for the issuer.
// safe to run again; it only creates what's missing.
//   pnpm --filter @passport/worker setup-issuer
// the authority key controls who may sign. outside local dev it belongs offline, not on the server.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AccountRole, address, appendTransactionMessageInstructions, createSolanaRpc, createSolanaRpcSubscriptions,
  createTransactionMessage, pipe, sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, type Instruction, type KeyPairSigner,
} from "@solana/kit";
import { fetchMaybeCredential, fetchMaybeSchema, getCreateCredentialInstruction, getCreateSchemaInstruction } from "sas-lib";
import { CREDENTIAL_NAME, SCHEMA_FIELDS, SCHEMA_LAYOUT, SCHEMA_NAME } from "@passport/core";
import { credentialAddresses, loadSigner } from "../src/chain.ts";

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
process.loadEnvFile(root(".env"));
const SOL = 1_000_000_000n;
const ISSUER_TOP_UP = 3n * SOL / 10n;

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL!);
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: createSolanaRpcSubscriptions(process.env.SOLANA_WS_URL!) });
const sol = (l: bigint) => `${Number(l) / Number(SOL)} SOL`;

async function keyAt(relPath: string): Promise<KeyPairSigner> {
  const file = root(relPath.replace(/^\.\//, ""));
  if (!existsSync(file)) {
    mkdirSync(root("secrets"), { recursive: true });
    writeFileSync(file, JSON.stringify({ privateKeyHex: randomBytes(32).toString("hex") }), { mode: 0o600 });
    console.log(`created ${relPath}`);
  }
  return loadSigner(file);
}

async function send(ixs: Instruction[], payer: KeyPairSigner) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m), (m) => appendTransactionMessageInstructions(ixs, m));
  const tx = await signTransactionMessageWithSigners(msg);
  await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
}

// system program transfer: instruction index 2 (u32 le) + lamports (u64 le)
function transfer(from: KeyPairSigner, to: string, lamports: bigint): Instruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return {
    programAddress: address("11111111111111111111111111111111"),
    accounts: [{ address: from.address, role: AccountRole.WRITABLE_SIGNER, signer: from }, { address: address(to), role: AccountRole.WRITABLE }],
    data,
  } as Instruction;
}

async function main() {
  const authority = await keyAt("./secrets/authority.json");
  const issuer = await keyAt(process.env.ISSUER_KEY_FILE ?? "./secrets/issuer.json");
  console.log(`authority: ${authority.address}\nissuer:    ${issuer.address}`);

  const { value: balance } = await rpc.getBalance(authority.address).send();
  console.log(`authority balance: ${sol(balance)}`);
  if (balance < ISSUER_TOP_UP + SOL / 20n) {
    console.log(`\nfund the authority at https://faucet.solana.com (devnet, 1 SOL), then run this again:\n  ${authority.address}`);
    process.exitCode = 1;
    return;
  }

  const { credential, schema } = await credentialAddresses(authority.address);
  if (!(await fetchMaybeCredential(rpc, credential)).exists) {
    await send([getCreateCredentialInstruction({ payer: authority, authority, credential, name: CREDENTIAL_NAME, signers: [issuer.address] })], authority);
    console.log("credential created");
  }
  if (!(await fetchMaybeSchema(rpc, schema)).exists) {
    await send([getCreateSchemaInstruction({
      payer: authority, authority, credential, schema, name: SCHEMA_NAME,
      description: "sha256 of an officially issued passport pdf and its version number",
      layout: SCHEMA_LAYOUT, fieldNames: [...SCHEMA_FIELDS],
    })], authority);
    console.log("schema created");
  }

  const { value: issuerBalance } = await rpc.getBalance(issuer.address).send();
  if (issuerBalance < SOL / 10n) {
    await send([transfer(authority, issuer.address, ISSUER_TOP_UP)], authority);
    console.log(`moved ${sol(ISSUER_TOP_UP)} to the issuer for fees`);
  }

  console.log(`\ncredential: https://explorer.solana.com/address/${credential}?cluster=devnet`);
  console.log(`schema:     https://explorer.solana.com/address/${schema}?cluster=devnet`);
  console.log(`\nAUTHORITY_ADDRESS=${authority.address}`);
}

// exit codes instead of process.exit(), which trips a libuv assertion on windows with sockets open
await main();
