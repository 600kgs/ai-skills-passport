import type { WorkshopInput } from "@passport/core";
import { auditLog, type Db, skills } from "@passport/db";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetLedgerDb, setupLedgerDb } from "../test/db.ts";
import { getWorkshop, listWorkshops, saveWorkshop, setWorkshopStatus, upcomingPublic } from "./workshops.ts";

let db: Db;
let pool: pg.Pool;
beforeAll(async () => ({ db, pool } = await setupLedgerDb()));
afterAll(() => pool.end());
beforeEach(async () => {
  await resetLedgerDb(db);
  await db.insert(skills).values({ skillId: "SKL-006", name: "AI-Assisted Research", category: "AI Skill", description: "d" });
});

const by = "career@btu.edu.ge";
const w = (title: string, startsAt: string, endsAt: string | null = null): WorkshopInput => ({
  kind: "workshop", title, titleEn: null, description: "d", descriptionEn: null, trainer: "T", startsAt, endsAt,
  location: "Room 305", skillId: "SKL-006", registrationUrl: "https://forms.gle/x",
});
const now = new Date("2026-11-26T08:00:00Z"); // 12:00 in tbilisi

async function add(input: WorkshopInput, status: "draft" | "published" | "cancelled" = "published") {
  const r = await saveWorkshop(db, null, input, by);
  if (!r.ok) throw new Error(r.error);
  if (status !== "draft") await setWorkshopStatus(db, r.value, status, by);
  return r.value;
}

describe("workshops", () => {
  it("saveWorkshop creates a draft, stores times as tbilisi and logs it", async () => {
    const id = await add(w("A", "2026-11-25T11:00", "2026-11-25T14:00"), "draft");
    const got = await getWorkshop(db, id);
    expect(got).toMatchObject({ title: "A", status: "draft", createdBy: by });
    expect(got!.startsAt.toISOString()).toBe("2026-11-25T07:00:00.000Z");
    expect((await db.select().from(auditLog))[0]).toMatchObject({ action: "workshop_created", subject: `W-${id}` });
  });

  it("saveWorkshop refuses bad input and an unknown skill", async () => {
    expect((await saveWorkshop(db, null, { ...w("A", "2026-11-25T11:00"), registrationUrl: "javascript:x" }, by)).ok).toBe(false);
    expect((await saveWorkshop(db, null, { ...w("A", "2026-11-25T11:00"), skillId: "SKL-999" }, by)).ok).toBe(false);
  });

  it("saveWorkshop edits an existing one", async () => {
    const id = await add(w("A", "2026-11-28T11:00"));
    expect((await saveWorkshop(db, id, w("B", "2026-11-29T11:00"), by)).ok).toBe(true);
    expect(await getWorkshop(db, id)).toMatchObject({ title: "B", status: "published" });
  });

  it("upcomingPublic hides drafts, cancelled and past events and orders by start", async () => {
    await add(w("later", "2026-12-05T11:00"));
    await add(w("soon", "2026-11-27T11:00"));
    await add(w("running now", "2026-11-26T10:00", "2026-11-26T14:00"));
    await add(w("over", "2026-11-25T11:00", "2026-11-25T14:00"));
    await add(w("draft", "2026-11-28T11:00"), "draft");
    await add(w("cancelled", "2026-11-28T11:00"), "cancelled");
    expect((await upcomingPublic(db, now)).map((x) => x.title)).toEqual(["running now", "soon", "later"]);
    expect((await upcomingPublic(db, now, 2)).map((x) => x.title)).toEqual(["running now", "soon"]);
  });

  it("listWorkshops splits upcoming, past and drafts", async () => {
    await add(w("soon", "2026-11-27T11:00"));
    await add(w("over", "2026-11-25T11:00", "2026-11-25T14:00"));
    await add(w("draft", "2026-11-28T11:00"), "draft");
    expect((await listWorkshops(db, "upcoming", now)).map((x) => x.title)).toEqual(["soon"]);
    expect((await listWorkshops(db, "past", now)).map((x) => x.title)).toEqual(["over"]);
    expect((await listWorkshops(db, "drafts", now)).map((x) => x.title)).toEqual(["draft"]);
  });
});
