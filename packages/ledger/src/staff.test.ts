import { auditLog, type Db, staff } from "@passport/db";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { getStaffRole, listStaff, removeStaff, setStaffRole } from "./staff.ts";

let db: Db;
let pool: pg.Pool;
const bootstrap = ["a@btu.edu.ge"];
const by = "a@btu.edu.ge";

beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());
beforeEach(() => resetLedgerDb(db));

describe("staff roles", () => {
  it("setStaffRole adds a btu email and logs staff_added", async () => {
    const r = await setStaffRole(db, { email: "nino@btu.edu.ge", role: "editor", by, bootstrap });
    expect(r.ok).toBe(true);
    expect(await getStaffRole(db, "nino@btu.edu.ge")).toBe("editor");
    const log = await db.select().from(auditLog);
    expect(log).toMatchObject([{ actor: by, action: "staff_added", subject: "nino@btu.edu.ge" }]);
  });

  it("changing a role logs staff_role_changed", async () => {
    await setStaffRole(db, { email: "nino@btu.edu.ge", role: "editor", by, bootstrap });
    await setStaffRole(db, { email: "nino@btu.edu.ge", role: "admin", by, bootstrap });
    expect(await getStaffRole(db, "nino@btu.edu.ge")).toBe("admin");
    expect((await db.select().from(auditLog)).map((a) => a.action)).toEqual(["staff_added", "staff_role_changed"]);
  });

  it("setStaffRole refuses a non-btu email", async () => {
    const r = await setStaffRole(db, { email: "nino@gmail.com", role: "viewer", by, bootstrap });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toContain("btu.edu.ge");
    expect(await db.select().from(staff)).toEqual([]);
  });

  it("setStaffRole and removeStaff refuse a bootstrap email", async () => {
    expect((await setStaffRole(db, { email: "A@btu.edu.ge", role: "viewer", by, bootstrap })).ok).toBe(false);
    expect((await removeStaff(db, { email: "a@btu.edu.ge", by, bootstrap })).ok).toBe(false);
    expect(await db.select().from(staff)).toEqual([]);
  });

  it("emails are stored lowercase", async () => {
    await setStaffRole(db, { email: " Mix@BTU.edu.ge ", role: "viewer", by, bootstrap });
    expect(await getStaffRole(db, "mix@btu.edu.ge")).toBe("viewer");
    expect(await getStaffRole(db, "MIX@btu.edu.ge")).toBe("viewer");
  });

  it("removeStaff takes the role away and logs it", async () => {
    await setStaffRole(db, { email: "nino@btu.edu.ge", role: "editor", by, bootstrap });
    expect((await removeStaff(db, { email: "nino@btu.edu.ge", by, bootstrap })).ok).toBe(true);
    expect(await getStaffRole(db, "nino@btu.edu.ge")).toBe(null);
    expect(await listStaff(db)).toEqual([]);
    expect((await db.select().from(auditLog)).at(-1)?.action).toBe("staff_removed");
  });

  it("removing someone who isn't staff is refused", async () => {
    expect((await removeStaff(db, { email: "nobody@btu.edu.ge", by, bootstrap })).ok).toBe(false);
  });
});
