import { describe, expect, it } from "vitest";
import { planImport } from "./import.ts";

const SHEET_HEADER = ["Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level",
  "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name",
  "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Passport Sync Status",
  "Synced Passport Version", "Synced At (UTC)", "Sync Error / Notes", "Verification Status"];
const giorgi = ["BTU-T-0001", "Giorgi", "Kapanadze", "btu-t-0001@example.org", "Business Administration", "Bachelor's", "BTU-AI-000125", "2026-09-15", "Active"];
const skill = ["SKL-001", "AI Literacy", "AI Skill", "BDG-AI-001", "Fundamentals of AI.", "2026-09-18"];
const sheetRow = (rec: string) => [...giorgi, rec, ...skill, "SYNCED", "V1", "2026-10-22 22:28 UTC", "", "CONFIRMED"];
// btu's sheet: title rows, header on row 4, records, then the notes block under them
const sheet = [["BTU | TEST DATA"], [], [], SHEET_HEADER, sheetRow("REC-0001"), sheetRow("REC-0002"), ["TECHNICAL NOTES"], ["All identities are fictional."]];

const FILE_HEADER = ["Record ID", "Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level", "Student Status",
  "Skill ID", "Skill Name", "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned"];
const fileRow = (rec: string, student = giorgi, cat = "AI Skill") =>
  [rec, student[0]!, student[1]!, student[2]!, student[3]!, student[4]!, student[5]!, student[8]!, "SKL-002", "Prompt Engineering", cat, "", "Writing prompts.", "2026-10-23"];
const col = (h: string) => SHEET_HEADER.indexOf(h);

describe("planImport", () => {
  it("maps columns by name, fills a known student's passport, and defaults to confirmed without a status column", async () => {
    const plan = await planImport(sheet, [FILE_HEADER, fileRow("REC-0003")]);
    expect(plan.preview.rows).toEqual([{ line: 2, recordId: "REC-0003", ok: true, errors: [] }]);
    expect(plan.insertAt).toBe(7); // under the last record, above the notes
    const v = plan.valid[0]!.values;
    expect(v[col("Record ID")]).toBe("REC-0003");
    expect(v[col("Passport ID (Existing)")]).toBe("BTU-AI-000125");
    expect(v[col("First Issued (Existing)")]).toBe("2026-09-15");
    expect(v[col("Verification Status")]).toBe("CONFIRMED");
    expect(v).toHaveLength(SHEET_HEADER.length);
  });

  it("keeps a blank status blank when the file has the column, so it lands as pending", async () => {
    const plan = await planImport(sheet, [[...FILE_HEADER, "Verification Status"], [...fileRow("REC-0003"), ""], [...fileRow("REC-0004"), "rejected"]]);
    expect(plan.valid.map((r) => r.values[col("Verification Status")])).toEqual(["", "rejected"]);
  });

  it("drops system columns and reports columns the sheet doesn't have", async () => {
    const plan = await planImport(sheet, [[...FILE_HEADER, "Passport Sync Status", "Comments"], [...fileRow("REC-0003"), "SYNCED", "hi"]]);
    expect(plan.valid[0]!.values[col("Passport Sync Status")]).toBe("");
    expect(plan.preview.ignoredColumns).toEqual(["Comments"]);
  });

  it("refuses ids already in the sheet or repeated in the file, and bad fields, but keeps the good rows", async () => {
    const plan = await planImport(sheet, [
      ["Imported from the registrar"], FILE_HEADER,
      fileRow("REC-0002"), fileRow("REC-0003"), fileRow("REC-0003"), fileRow("REC-0004", giorgi, "Magic Skill"), fileRow("REC-0005"),
    ]);
    const byLine = Object.fromEntries(plan.preview.rows.map((r) => [r.line, r]));
    expect(byLine[3]!.errors.join()).toContain("(already on row 6 of the sheet)");
    expect(byLine[4]!.ok).toBe(true);
    expect(byLine[5]!.errors.join()).toContain("(first on line 4 of this file)");
    expect(byLine[6]!.errors.join()).toContain('unknown category "Magic Skill"');
    expect(plan.valid.map((r) => r.recordId)).toEqual(["REC-0003", "REC-0005"]);
  });

  it("refuses a known student whose name in the file differs from the sheet", async () => {
    const plan = await planImport(sheet, [FILE_HEADER, fileRow("REC-0003", ["BTU-T-0001", "Gela", ...giorgi.slice(2)])]);
    expect(plan.preview.rows[0]!.errors.join()).toContain("disagrees");
    expect(plan.valid).toEqual([]);
  });

  describe("against the ledger, where deleted rows live on", () => {
    // nika's rows were deleted from the sheet; the ledger still has his student, passport and REC-0070
    const nika = ["BTU-T-3006", "Nika", "Loliashvili", "nika.loliashvili.1@btu.edu.ge", "Information Technologies", "Bachelor's", "", "", "Active"];
    const ledger = {
      recordIds: new Set(["REC-0001", "REC-0002", "REC-0070"]),
      students: new Map([
        ["BTU-T-0001", { firstName: "Giorgi", lastName: "Kapanadze", email: "btu-t-0001@example.org", passportId: "BTU-AI-000125" }],
        ["BTU-T-3006", { firstName: "Nika", lastName: "Loliashvili", email: "nika.loliashvili.1@btu.edu.ge", passportId: "BTU-AI-000150" }],
      ]),
    };
    const only = async (row: string[]) => (await planImport(sheet, [FILE_HEADER, row], ledger)).preview.rows[0]!;

    it("refuses a record id that only the ledger still has, and says how to fix it", async () => {
      const r = await only(fileRow("REC-0070", nika));
      expect(r.ok).toBe(false);
      expect(r.errors.join()).toContain("REC-0070 was used before and its row was deleted from the sheet");
    });

    it("refuses a ledger student whose name or email in the file differs", async () => {
      expect((await only(fileRow("REC-0100", ["BTU-T-3006", "Nikoloz", ...nika.slice(2)]))).errors.join()).toContain("identity fields can't change");
    });

    it("refuses an email or passport id that already belongs to another student", async () => {
      const stranger = ["BTU-T-0500", "Ana", "Gelashvili", "nika.loliashvili.1@btu.edu.ge", "Information Technologies", "Bachelor's", "", "", "Active"];
      expect((await only(fileRow("REC-0100", stranger))).errors.join()).toContain("already belongs to BTU-T-3006");
      const withPassport = [...FILE_HEADER, "Passport ID (Existing)"];
      const ownEmail = stranger.with(3, "btu-t-0500@example.org");
      const plan = await planImport(sheet, [withPassport, [...fileRow("REC-0100", ownEmail), "BTU-AI-000150"]], ledger);
      expect(plan.preview.rows[0]!.errors.join()).toContain("Passport ID BTU-AI-000150 already belongs to BTU-T-3006");
    });

    it("still adds a ledger student's new skill when the details match", async () => {
      expect(await only(fileRow("REC-0100", nika))).toMatchObject({ ok: true, errors: [] });
      expect(await only(fileRow("REC-0003"))).toMatchObject({ ok: true, errors: [] });
    });
  });

  it("says what's wrong with a file it can't use at all", async () => {
    expect((await planImport(sheet, [["Name", "Skill"], ["Giorgi", "AI"]])).preview.error).toContain("header row with Student ID and Record ID");
    expect((await planImport(sheet, [FILE_HEADER, [], ["", "note under the table, in the Student ID column"]])).preview.error).toContain("no records");
    const many = [FILE_HEADER, ...Array.from({ length: 501 }, (_, i) => fileRow(`REC-${1000 + i}`))];
    expect((await planImport(sheet, many)).preview.error).toContain("at most 500");
  });
});
