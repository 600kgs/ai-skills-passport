import { describe, expect, it } from "vitest";
import { parseSheet } from "./sheet.ts";

// same shape as btu's test sheet: title rows, header on row 4, notes under the table
const HEADER = ["Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level",
  "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name",
  "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Passport Sync Status"];
const giorgi = ["BTU-T-0001", "Giorgi", "Kapanadze", "btu-t-0001@example.org", "Business Administration", "Bachelor's",
  "BTU-AI-000125", "2026-09-15", "Active"];
const row = (student: string[], rec: string, skill = "SKL-001", name = "AI Literacy", cat = "AI Skill", stamp = "BDG-AI-001") =>
  [...student, rec, skill, name, cat, stamp, "Fundamentals of AI.", "2026-09-18", "NOT SYNCED"];
const sheet = (...records: string[][]) => [
  ["BTU | AI SKILLS DIGITAL PASSPORT | HACKATHON TEST DATA"], ["A-P: input"], [], HEADER, ...records,
  [], ["TECHNICAL NOTES / INTEGRATION CONTRACT"], ["All identities are fictional."],
];

describe("parseSheet", () => {
  it("finds the header by name and skips the notes block", async () => {
    const parsed = await parseSheet(sheet(row(giorgi, "REC-0001"), row(giorgi, "REC-0015", "SKL-008", "AI Workflow Automation", "AI Applied Skill", "BDG-AI-002")));
    expect(parsed.headerRow).toBe(4);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results.every((r) => r.ok)).toBe(true);
  });

  it("maps columns by name even when btu reorders them", async () => {
    const swapped = sheet(row(giorgi, "REC-0001")).map((r) => (r.length > 2 ? [r[1], r[0], ...r.slice(2)] : r)) as string[][];
    const [r] = (await parseSheet(swapped)).results;
    expect(r?.ok && r.record.firstName).toBe("Giorgi");
  });

  it("rejects a wrong student id instead of guessing", async () => {
    const [r] = (await parseSheet(sheet(row(["BTU-X-0001", ...giorgi.slice(1)], "REC-0001")))).results;
    expect(r?.ok).toBe(false);
    expect(!r?.ok && r?.errors.join()).toContain("bad Student ID");
  });

  it("rejects incomplete rows", async () => {
    const incomplete = row(giorgi, "REC-0001");
    incomplete[11] = "";
    const [r] = (await parseSheet(sheet(incomplete))).results;
    expect(!r?.ok && r?.errors.join()).toContain("missing skill name");
  });

  it("flags a duplicate record id but keeps the first one", async () => {
    const { results } = await parseSheet(sheet(row(giorgi, "REC-0001"), row(giorgi, "REC-0001")));
    expect(results[0]?.ok).toBe(true);
    expect(!results[1]?.ok && results[1]?.errors.join()).toContain("duplicate Record ID");
  });

  it("flags a student whose name differs between rows", async () => {
    const typo = ["BTU-T-0001", "Giorgii", ...giorgi.slice(2)];
    const { results } = await parseSheet(sheet(row(giorgi, "REC-0001"), row(typo, "REC-0002")));
    expect(!results[1]?.ok && results[1]?.errors.join()).toContain("disagrees");
  });

  it("stops impossible dates as a row error, so they never reach the database", async () => {
    const dated = (d: string) => { const r = row(giorgi, "REC-0001"); r[15] = d; return r; };
    for (const bad of ["2026-02-31", "2026-13-01", "2026-00-10"]) {
      const [r] = (await parseSheet(sheet(dated(bad)))).results;
      expect(!r?.ok && r?.errors.join()).toContain("must be a real date");
    }
    expect((await parseSheet(sheet(dated("2028-02-29")))).results[0]?.ok).toBe(true);
  });

  it("accepts only the three real categories, not names every object has", async () => {
    for (const cat of ["constructor", "toString"]) {
      const [r] = (await parseSheet(sheet(row(giorgi, "REC-0001", "SKL-001", "AI Literacy", cat, "")))).results;
      expect(!r?.ok && r?.errors.join()).toContain(`unknown category "${cat}"`);
    }
  });

  it("rejects an email that isn't one", async () => {
    for (const email of ["giorgi", "giorgi@", "giorgi@gmail"]) {
      const [r] = (await parseSheet(sheet(row([...giorgi.slice(0, 3), email, ...giorgi.slice(4)], "REC-0001")))).results;
      expect(!r?.ok && r?.errors.join()).toContain("bad email");
    }
  });

  it("flags a stamp that doesn't match the category", async () => {
    const [r] = (await parseSheet(sheet(row(giorgi, "REC-0001", "SKL-001", "AI Literacy", "AI Skill", "BDG-AI-003")))).results;
    expect(r?.ok).toBe(false);
  });

  it("reads an optional verification status column", async () => {
    const rows = sheet(row(giorgi, "REC-0001"), row(giorgi, "REC-0002"));
    rows[3] = [...HEADER, "Verification Status"];
    rows[4] = [...rows[4]!, "CONFIRMED"];
    rows[5] = [...rows[5]!, "pending"];
    const { results } = await parseSheet(rows);
    expect(results.map((r) => r.ok && r.record.verification)).toEqual(["CONFIRMED", "PENDING"]);
  });

  it("treats a blank status cell as pending once the column exists", async () => {
    const rows = sheet(row(giorgi, "REC-0001"));
    rows[3] = [...HEADER, "Verification Status"];
    rows[4] = [...rows[4]!, ""];
    const [r] = (await parseSheet(rows)).results;
    expect(r?.ok && r.record.verification).toBe("PENDING");
  });

  it("keeps the row hash when a status column with confirmed is added", async () => {
    const withStatus = (status: string) => {
      const rows = sheet(row(giorgi, "REC-0001"));
      rows[3] = [...HEADER, "Verification Status"];
      rows[4] = [...rows[4]!, status];
      return rows;
    };
    const hashes = await Promise.all([sheet(row(giorgi, "REC-0001")), withStatus("CONFIRMED"), withStatus("confirmed"), withStatus("REJECTED")]
      .map(async (s) => { const [r] = (await parseSheet(s)).results; return r?.ok && r.record.rowHash; }));
    expect(hashes[1]).toBe(hashes[0]);
    expect(hashes[2]).toBe(hashes[0]);
    expect(hashes[3]).not.toBe(hashes[0]);
  });

  it("gives a new row hash when the content is edited", async () => {
    const [a] = (await parseSheet(sheet(row(giorgi, "REC-0001")))).results;
    const edited = row(giorgi, "REC-0001");
    edited[14] = "Edited description.";
    const [b] = (await parseSheet(sheet(edited))).results;
    expect(a?.ok && b?.ok && a.record.rowHash !== b.record.rowHash).toBe(true);
  });
});
