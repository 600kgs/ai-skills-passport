import { describe, expect, it } from "vitest";
import { bootstrapEmails, resolveRole, roleAtLeast } from "./roles.ts";

describe("role order", () => {
  it("a higher role can do what a lower one can", () => {
    expect(roleAtLeast("admin", "editor")).toBe(true);
    expect(roleAtLeast("superadmin", "superadmin")).toBe(true);
  });

  it("a lower role can't", () => {
    expect(roleAtLeast("editor", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
  });

  it("no role can't do anything", () => {
    expect(roleAtLeast(null, "viewer")).toBe(false);
  });
});

describe("resolving a signed-in account's role", () => {
  it("server config emails are superadmins regardless of case and spaces", () => {
    expect(resolveRole({ email: "A@btu.edu.ge", emailVerified: true }, null, " a@btu.edu.ge ,x@btu.edu.ge")).toBe("superadmin");
    expect(resolveRole({ email: "x@btu.edu.ge", emailVerified: true }, "viewer", " a@btu.edu.ge ,x@btu.edu.ge")).toBe("superadmin");
  });

  it("everyone else gets the role stored for them", () => {
    expect(resolveRole({ email: "b@btu.edu.ge", emailVerified: true }, "editor", "a@btu.edu.ge")).toBe("editor");
    expect(resolveRole({ email: "b@btu.edu.ge", emailVerified: true }, null, "a@btu.edu.ge")).toBe(null);
  });

  it("an account that isn't a verified btu one never gets a role", () => {
    expect(resolveRole({ email: "b@gmail.com", emailVerified: true }, "admin", "")).toBe(null);
    expect(resolveRole({ email: "b@gmail.com", emailVerified: true }, null, "b@gmail.com")).toBe(null);
    expect(resolveRole({ email: "b@btu.edu.ge", emailVerified: false }, "admin", "")).toBe(null);
  });

  it("an empty or unset list gives nobody superadmin", () => {
    expect(bootstrapEmails(undefined)).toEqual([]);
    expect(bootstrapEmails(" , ")).toEqual([]);
  });
});
