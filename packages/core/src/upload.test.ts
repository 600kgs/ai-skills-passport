import { describe, expect, it } from "vitest";
import { parseRecordUpload, RECORD_UPLOAD_HEADERS } from "./upload.ts";

const row = ["BTU-T-0001", "Nino", "Maisuradze", "nino.m@btu.edu.ge", "Computer Science", "Bachelor", "Active", "SKL-001", "2026-11-25", "", ""];

describe("record upload", () => {
  it("reads the template", () => {
    const r = parseRecordUpload([[...RECORD_UPLOAD_HEADERS], row]);
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([{
      line: 2, errors: [],
      item: {
        student: { studentId: "BTU-T-0001", firstName: "Nino", lastName: "Maisuradze", email: "nino.m@btu.edu.ge", program: "Computer Science", educationLevel: "Bachelor", status: "Active" },
        record: { skillId: "SKL-001", dateEarned: "2026-11-25", earnedThrough: null, verification: "PENDING" },
      },
    }]);
  });

  it("reads an old file with BTU Email (Test), a title row above the header and columns in any order", () => {
    const header = ["Skill ID", "Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level", "Student Status", "Date Earned"];
    const r = parseRecordUpload([["Passport Skill Records"], header, ["SKL-002", "BTU-T-0002", "G", "K", "g.k@btu.edu.ge", "CS", "Master", "Active", "2026-11-01"]]);
    expect(r.rows[0]).toMatchObject({ line: 3, errors: [], item: { student: { email: "g.k@btu.edu.ge" }, record: { skillId: "SKL-002" } } });
  });

  it("ignores Record ID and Skill Name columns and lists them in ignoredColumns", () => {
    const r = parseRecordUpload([[...RECORD_UPLOAD_HEADERS, "Record ID", "Skill Name"], [...row, "REC-0099", "Whatever"]]);
    expect(r.ignoredColumns).toEqual(["Record ID", "Skill Name"]);
    expect(r.rows[0]!.errors).toEqual([]);
  });

  it("blank verification is PENDING, CONFIRMED is kept, \"maybe\" is an error", () => {
    const at = RECORD_UPLOAD_HEADERS.indexOf("Verification Status");
    const withStatus = (v: string) => row.map((c, i) => (i === at ? v : c));
    const r = parseRecordUpload([[...RECORD_UPLOAD_HEADERS], withStatus(""), withStatus("confirmed"), withStatus("maybe")]);
    expect(r.rows.map((x) => x.item.record.verification)).toEqual(["PENDING", "CONFIRMED", "PENDING"]);
    expect(r.rows[2]!.errors[0]).toContain("maybe");
  });

  it("skips rows with no student id and no skill id", () => {
    const r = parseRecordUpload([[...RECORD_UPLOAD_HEADERS], row, ["", "", "", "", "", "", "", "", "", "note", ""]]);
    expect(r.rows).toHaveLength(1);
  });

  it("refuses a file without the Student ID header with a message naming the template", () => {
    expect(parseRecordUpload([["Name", "Skill"], ["a", "b"]]).error).toContain("template");
  });

  it("refuses a file that misses a required column", () => {
    expect(parseRecordUpload([["Student ID", "Skill ID"], ["BTU-T-1", "SKL-001"]]).error).toContain("First Name");
  });

  it("refuses more than 500 rows", () => {
    expect(parseRecordUpload([[...RECORD_UPLOAD_HEADERS], ...Array(501).fill(row)]).error).toContain("500");
  });
});
