import { describe, expect, it } from "vitest";
import { isBtuAccount, sameEmail } from "./access.ts";

describe("student access", () => {
  it("lets in verified btu accounts", () => {
    expect(isBtuAccount({ email: "Nika.L@btu.edu.ge", emailVerified: true })).toBe(true);
  });

  it("keeps out other domains and look-alikes", () => {
    expect(isBtuAccount({ email: "someone@gmail.com", emailVerified: true })).toBe(false);
    expect(isBtuAccount({ email: "x@notbtu.edu.ge", emailVerified: true })).toBe(false);
    expect(isBtuAccount({ email: "x@btu.edu.ge.evil.com", emailVerified: true })).toBe(false);
    expect(isBtuAccount({ email: "x@btu.edu.ge@gmail.com", emailVerified: true })).toBe(false);
  });

  it("keeps out unverified emails", () => {
    expect(isBtuAccount({ email: "x@btu.edu.ge", emailVerified: false })).toBe(false);
  });

  it("matches passport owners regardless of case and spaces", () => {
    expect(sameEmail(" Giorgi.K@BTU.edu.ge", "giorgi.k@btu.edu.ge")).toBe(true);
    expect(sameEmail("giorgi.k@btu.edu.ge", "giorgi.ka@btu.edu.ge")).toBe(false);
  });
});
