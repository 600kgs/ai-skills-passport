import { describe, expect, it } from "vitest";
import type { ChainRecord } from "./chain-read.ts";
import { sha256 } from "./hash.ts";
import { verdict } from "./verdict.ts";

const pdf = new TextEncoder().encode("issued pdf");
const record = async (): Promise<ChainRecord> => ({ address: "a", credential: "c", signer: "s", pdfSha256: await sha256(pdf), version: 1 });

describe("verdict", () => {
  it("unknown code", async () => {
    expect(verdict({ record: null, latest: null, fileHash: await sha256(pdf) }).outcome).toBe("unknown");
  });

  it("record found, file not checked yet", async () => {
    expect(verdict({ record: await record(), latest: { isLatest: true }, fileHash: null })).toEqual({ record: "latest", file: "not-checked", outcome: "record-only" });
  });

  it("authentic and latest", async () => {
    expect(verdict({ record: await record(), latest: { isLatest: true }, fileHash: await sha256(pdf) }).outcome).toBe("authentic-latest");
  });

  it("authentic but outdated", async () => {
    expect(verdict({ record: await record(), latest: { isLatest: false }, fileHash: await sha256(pdf) }).outcome).toBe("authentic-outdated");
  });

  it("modified file, whatever the version", async () => {
    const v = verdict({ record: await record(), latest: { isLatest: false }, fileHash: await sha256("edited pdf") });
    expect(v).toEqual({ record: "outdated", file: "modified", outcome: "modified" });
  });

  it("still proves the file when our server is down, but doesn't claim it's the latest", async () => {
    const v = verdict({ record: await record(), latest: null, fileHash: await sha256(pdf) });
    expect(v).toEqual({ record: "unconfirmed", file: "authentic", outcome: "authentic-unconfirmed" });
  });
});
