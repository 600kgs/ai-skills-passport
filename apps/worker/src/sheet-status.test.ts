import { describe, expect, it } from "vitest";
import { setRecordStatus } from "./sheet-status.ts";
import type { CellUpdate, SheetSource } from "./sheets.ts";

const HEADER = ["Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level",
  "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name",
  "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Verification Status"];
const row = (rec: string, status: string) => ["BTU-T-0001", "Giorgi", "Kapanadze", "btu-t-0001@example.org", "Business Administration",
  "Bachelor's", "BTU-AI-000125", "2026-09-15", "Active", rec, "SKL-001", "AI Literacy", "AI Skill", "BDG-AI-001",
  "Fundamentals of AI.", "2026-09-18", status];

class FakeSheet implements SheetSource {
  writes: CellUpdate[] = [];
  constructor(public grid: string[][]) {}
  async read() { return this.grid.map((r) => [...r]); }
  async write(updates: CellUpdate[]) { this.writes.push(...updates); }
}
const sheetOf = (...rows: string[][]) => new FakeSheet([["BTU | TEST DATA"], [], [], HEADER, ...rows]);

describe("setRecordStatus", () => {
  it("writes the decision into the status cell of that record's row", async () => {
    const sheet = sheetOf(row("REC-0001", "CONFIRMED"), row("REC-0002", "PENDING"));
    await expect(setRecordStatus(sheet, "REC-0002", "CONFIRMED")).resolves.toEqual({ row: 6 });
    expect(sheet.writes).toEqual([{ row: 6, col: 16, value: "CONFIRMED" }]);
  });

  it("treats a blank status cell as pending", async () => {
    const sheet = sheetOf(row("REC-0001", ""));
    await setRecordStatus(sheet, "REC-0001", "REJECTED");
    expect(sheet.writes).toEqual([{ row: 5, col: 16, value: "REJECTED" }]);
  });

  it("won't change a record that is already confirmed or rejected", async () => {
    const sheet = sheetOf(row("REC-0001", "CONFIRMED"), row("REC-0002", "rejected"));
    await expect(setRecordStatus(sheet, "REC-0001", "REJECTED")).rejects.toThrow("is CONFIRMED, not PENDING");
    await expect(setRecordStatus(sheet, "REC-0002", "CONFIRMED")).rejects.toThrow("is REJECTED, not PENDING");
    expect(sheet.writes).toEqual([]);
  });

  it("refuses a record that isn't there, or is there twice", async () => {
    const sheet = sheetOf(row("REC-0001", "PENDING"), row("REC-0001", "PENDING"));
    await expect(setRecordStatus(sheet, "REC-0009", "CONFIRMED")).rejects.toThrow("isn't in the sheet");
    await expect(setRecordStatus(sheet, "REC-0001", "CONFIRMED")).rejects.toThrow("more than one row");
    expect(sheet.writes).toEqual([]);
  });

  it("needs the status column", async () => {
    const sheet = new FakeSheet([HEADER.slice(0, -1), row("REC-0001", "PENDING").slice(0, -1)]);
    await expect(setRecordStatus(sheet, "REC-0001", "CONFIRMED")).rejects.toThrow("no Verification Status column");
  });
});
