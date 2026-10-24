import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, passports, passportVersions, skillAwards, sql, students, type Db } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import { loadNotice, renderMail, shouldEmail, type Notice } from "./notify.ts";

const notice: Notice = {
  email: "otaritomas.sepashvili.1@btu.edu.ge", firstName: "Otari Tomas", lastName: "Sepashvili", passportId: "BTU-AI-000143",
  versionNo: 3, code: "F8ZZ-YDVZ-SH", newSkills: ["AI Ethics & Responsible Use"],
};

describe("renderMail", () => {
  it("writes georgian first, then english, with the passport and verify links", () => {
    const m = renderMail(notice, "https://passport.btumarket.ge/");
    expect(m.subject).toBe("თქვენი AI უნარების პასპორტი განახლდა (V3) | Your AI Skills Passport was updated (V3)");
    expect(m.to).toEqual({ email: notice.email, name: "Otari Tomas Sepashvili" });
    expect(m.html.indexOf('lang="ka"')).toBeLessThan(m.html.indexOf('lang="en"'));
    expect(m.html).toContain('href="https://passport.btumarket.ge/me"');
    expect(m.html).toContain("https://passport.btumarket.ge/v/F8ZZ-YDVZ-SH");
    expect(m.text).toContain("New: AI Ethics & Responsible Use");
  });

  it("says issued, not updated, for a first version", () => {
    expect(renderMail({ ...notice, versionNo: 1 }, "https://x.ge").subject).toContain("was issued");
  });

  it("escapes data from the sheet in the html", () => {
    const m = renderMail({ ...notice, firstName: "<b>Eve</b>", newSkills: ['AI & "Ethics"'] }, "https://x.ge");
    expect(m.html).not.toContain("<b>Eve</b>");
    expect(m.html).toContain("&#60;b&#62;Eve&#60;/b&#62;");
    expect(m.html).toContain("AI &#38; &#34;Ethics&#34;");
  });
});

describe("shouldEmail", () => {
  it("skips the test data's fictional addresses and mails real ones", () => {
    expect(shouldEmail("btu-t-0001@example.org")).toBe(false);
    expect(shouldEmail(" Someone@EXAMPLE.com")).toBe(false);
    expect(shouldEmail("otaritomas.sepashvili.1@btu.edu.ge")).toBe(true);
  });
});

// same test database as the sync tests (docker compose `db`)
const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_test";
let db: Db;
let end: () => Promise<void>;

describe("loadNotice", () => {
  beforeAll(async () => {
    const c = createDb(TEST_URL);
    db = c.db;
    end = () => c.pool.end();
    await runMigrations(db);
  });
  afterAll(() => end());
  beforeEach(async () => {
    await db.execute(sql`truncate audit_log, sync_runs, skill_awards, passport_versions, passports, students restart identity cascade`);
  });

  it("names only the skills the version added compared with the one before", async () => {
    await db.insert(students).values({ studentId: "BTU-T-0025", firstName: "Otari Tomas", lastName: "Sepashvili", email: notice.email, program: "IT", educationLevel: "Bachelor's", status: "Active" });
    await db.insert(passports).values({ passportId: "BTU-AI-000143", studentId: "BTU-T-0025", firstIssued: "2026-10-22" });
    const award = (recordId: string, skillName: string) => ({
      recordId, studentId: "BTU-T-0025", skillId: "SKL-1", skillName, category: "AI Skill", description: "d",
      dateEarned: "2026-10-22", verification: "CONFIRMED", rowHash: recordId, state: "applied" as const,
    });
    await db.insert(skillAwards).values([award("REC-1", "AI-Assisted Research"), award("REC-2", "Prompt Engineering")]);
    const version = (versionNo: number, code: string, ids: string[]) => ({
      passportId: "BTU-AI-000143", versionNo, verificationCode: code, state: "issued" as const, skillCount: ids.length,
      includedRecordIds: ids, pdfSha256: "x", txSignature: "y", issuedAt: new Date(),
    });
    await db.insert(passportVersions).values([version(1, "AAAA-AAAA-AA", ["REC-1"]), version(2, "BBBB-BBBB-BB", ["REC-1", "REC-2"])]);

    expect(await loadNotice(db, "BBBB-BBBB-BB")).toMatchObject({ versionNo: 2, newSkills: ["Prompt Engineering"], email: notice.email });
    expect(await loadNotice(db, "AAAA-AAAA-AA")).toMatchObject({ versionNo: 1, newSkills: ["AI-Assisted Research"] });
    expect(await loadNotice(db, "ZZZZ-ZZZZ-ZZ")).toBeNull();
  });
});
