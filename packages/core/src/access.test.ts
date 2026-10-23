import { describe, expect, it } from "vitest";
import { isAdmin, isBtuAccount, sameEmail } from "./access.ts";

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

describe("admin access", () => {
  const admins = " Oto.S@btu.edu.ge , nika.l@btu.edu.ge,";

  it("lets in listed btu accounts regardless of case and spaces", () => {
    expect(isAdmin({ email: "oto.s@BTU.edu.ge", emailVerified: true }, admins)).toBe(true);
    expect(isAdmin({ email: "nika.l@btu.edu.ge", emailVerified: true }, admins)).toBe(true);
  });

  it("keeps out students who aren't listed", () => {
    expect(isAdmin({ email: "giorgi.k@btu.edu.ge", emailVerified: true }, admins)).toBe(false);
  });

  it("keeps out a listed email that isn't a verified btu account", () => {
    expect(isAdmin({ email: "oto@gmail.com", emailVerified: true }, "oto@gmail.com")).toBe(false);
    expect(isAdmin({ email: "oto.s@btu.edu.ge", emailVerified: false }, admins)).toBe(false);
  });

  it("lets nobody in when the list is unset or empty", () => {
    expect(isAdmin({ email: "oto.s@btu.edu.ge", emailVerified: true }, undefined)).toBe(false);
    expect(isAdmin({ email: "oto.s@btu.edu.ge", emailVerified: true }, " , ")).toBe(false);
  });
});
