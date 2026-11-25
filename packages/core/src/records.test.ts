import { describe, expect, it } from "vitest";
import { realDate, recordHash, type RecordInput, type StudentInput, validateRecord, validateStudent } from "./records.ts";

const student: StudentInput = {
  studentId: "BTU-T-0001", firstName: "Nino", lastName: "Maisuradze", email: "nino.m@btu.edu.ge",
  program: "Computer Science", educationLevel: "Bachelor", status: "Active",
};
const record: RecordInput = { skillId: "SKL-001", dateEarned: "2026-11-25", earnedThrough: null, verification: "PENDING" };
const catalog = new Set(["SKL-001"]);
const skill = { name: "AI Literacy", category: "AI Skill", description: "d" };

describe("student fields", () => {
  it("accepts test ids and real-looking ids", () => {
    expect(validateStudent(student)).toEqual([]);
    expect(validateStudent({ ...student, studentId: "22100123" })).toEqual([]);
  });

  it("refuses an id with spaces or other characters", () => {
    expect(validateStudent({ ...student, studentId: "a b" })).toHaveLength(1);
    expect(validateStudent({ ...student, studentId: "" })).toHaveLength(1);
    expect(validateStudent({ ...student, studentId: "x".repeat(33) })).toHaveLength(1);
  });

  it("refuses a non-btu email", () => {
    expect(validateStudent({ ...student, email: "nino@gmail.com" })[0]).toContain("btu.edu.ge");
  });

  it("names every missing field", () => {
    expect(validateStudent({ ...student, firstName: " ", program: "" })).toHaveLength(2);
  });
});

describe("record fields", () => {
  it("accepts a known skill on a real date", () => {
    expect(validateRecord(record, catalog)).toEqual([]);
  });

  it("refuses 2026-02-31 and an unknown skill", () => {
    expect(validateRecord({ ...record, dateEarned: "2026-02-31" }, catalog)).toHaveLength(1);
    expect(validateRecord({ ...record, skillId: "SKL-999" }, catalog)).toHaveLength(1);
  });

  it("refuses a verification other than pending or confirmed", () => {
    expect(validateRecord({ ...record, verification: "REJECTED" as never }, catalog)).toHaveLength(1);
  });

  it("realDate rejects impossible and malformed dates", () => {
    expect(realDate("2026-11-25")).toBe(true);
    expect(realDate("2026-02-31")).toBe(false);
    expect(realDate("25.11.2026")).toBe(false);
  });
});

describe("record hash", () => {
  it("changes when dateEarned changes", async () => {
    const a = await recordHash("BTU-T-0001", record, skill);
    expect(await recordHash("BTU-T-0001", { ...record, dateEarned: "2026-11-26" }, skill)).not.toBe(a);
  });

  it("doesn't change when the record is confirmed", async () => {
    expect(await recordHash("BTU-T-0001", { ...record, verification: "CONFIRMED" }, skill))
      .toBe(await recordHash("BTU-T-0001", record, skill));
  });
});
