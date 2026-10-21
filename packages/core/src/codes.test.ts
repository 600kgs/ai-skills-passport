import { describe, expect, it } from "vitest";
import { newVerificationCode, normalizeCode } from "./codes.ts";
import { nonceFromCode } from "./chain.ts";
import { equalBytes } from "./hash.ts";

describe("verification codes", () => {
  it("look like XXXX-XXXX-XX and never repeat in practice", () => {
    const codes = new Set(Array.from({ length: 10_000 }, newVerificationCode));
    expect(codes.size).toBe(10_000);
    for (const c of codes) expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/);
  });

  it("normalize what people type", () => {
    expect(normalizeCode("7kq4 m2xd 9p")).toBe("7KQ4-M2XD-9P");
    expect(normalizeCode("7KQ4M2XD9P")).toBe("7KQ4-M2XD-9P");
    expect(normalizeCode("OOOO-IIII-LL")).toBe("0000-1111-11");
  });

  it("reject wrong length or letters outside the alphabet", () => {
    expect(normalizeCode("7KQ4-M2XD")).toBeNull();
    expect(normalizeCode("7KQ4-M2XD-9U")).toBeNull();
  });

  it("map to one stable chain nonce per code", async () => {
    expect(equalBytes(await nonceFromCode("7KQ4-M2XD-9P"), await nonceFromCode("7KQ4-M2XD-9P"))).toBe(true);
    expect(equalBytes(await nonceFromCode("7KQ4-M2XD-9P"), await nonceFromCode("7KQ4-M2XD-9Q"))).toBe(false);
  });
});
