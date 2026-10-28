// checks the live deployment the way a third party would: the issuer file the site publishes,
// the public chain, and real issued pdfs. it only reads, so it needs no keys and spends nothing.
//   pnpm --filter @passport/worker test:live
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { findRecord, newVerificationCode, sha256, verdict } from "@passport/core";

type IssuerDocument = { domain: string; network: string; rpcUrl: string; authority: string; credential: string };

const SITE = process.env.LIVE_SITE ?? "https://passport.btumarket.ge";
const pdf = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

// two issued versions of one passport, and the forged copy of v10 from the pitch (one skill renamed)
const V10 = { code: "SE9C-DN3W-75", file: pdf("BTU-AI-000143-V10.pdf") };
const V11 = { code: "R24Z-0RS5-R8", file: pdf("BTU-AI-000143-V11.pdf") };
const FORGED_V10 = pdf("BTU-AI-000143-V10-forged.pdf");

let issuer: IssuerDocument;
const record = (code: string) => findRecord(issuer.rpcUrl, issuer.authority, code);
// "latest" is the only part a verifier takes from our server; the rest comes from the chain
const isLatest = async (code: string) => ((await (await fetch(`${SITE}/api/verify/${code}`)).json()) as { isLatest: boolean }).isLatest;

beforeAll(async () => {
  issuer = (await (await fetch(`${SITE}/.well-known/btu-passport-issuer.json`)).json()) as IssuerDocument;
});

describe("live verification, as a third party", () => {
  it("the issuer file names our domain and a keyless public rpc", () => {
    expect(issuer.domain).toBe(new URL(SITE).host);
    expect(issuer.network).toBe("devnet");
    expect(new URL(issuer.rpcUrl).host).toBe("api.devnet.solana.com");
  });

  it("a real pdf matches its record, under btu's credential", async () => {
    const rec = await record(V11.code);
    expect(rec).not.toBeNull();
    expect(rec!.credential).toBe(issuer.credential);
    expect(rec!.version).toBe(11);
    expect(verdict({ record: rec, latest: null, fileHash: await sha256(V11.file) }).file).toBe("authentic");
  });

  it("one changed byte makes the same pdf fail", async () => {
    const tampered = V11.file.slice();
    const mid = Math.floor(tampered.length / 2);
    tampered[mid] = tampered[mid]! ^ 1;
    expect(verdict({ record: await record(V11.code), latest: null, fileHash: await sha256(tampered) }).outcome).toBe("modified");
  });

  it("the forged pdf from the pitch is caught", async () => {
    expect(verdict({ record: await record(V10.code), latest: null, fileHash: await sha256(FORGED_V10) }).outcome).toBe("modified");
  });

  it("an older version is authentic but outdated", async () => {
    const rec = await record(V10.code);
    expect(rec!.version).toBe(10);
    const v = verdict({ record: rec, latest: { isLatest: await isLatest(V10.code) }, fileHash: await sha256(V10.file) });
    expect(v.outcome).toBe("authentic-outdated");
  });

  it("a made-up code has no record", async () => {
    expect(verdict({ record: await record(newVerificationCode()), latest: null, fileHash: null }).outcome).toBe("unknown");
  });
});
