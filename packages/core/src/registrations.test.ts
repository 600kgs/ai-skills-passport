import { describe, expect, it } from "vitest";
import { nameFromEmail, parseCsv, parseRegistrations } from "./registrations.ts";

const header = ["Timestamp", "Email address", "სახელი / First name (Latin letters)", "გვარი / Last name (Latin letters)", "სტუდენტის ID / Student ID", "პროგრამა / Program", "საფეხური / Education level"];
const nino = ["2026/11/20 10:00", "Nino.M@btu.edu.ge", "Nino", "Maisuradze", "BTU-T-0001", "Computer Science", "Bachelor"];

describe("registration export", () => {
  it("matches bilingual question titles and Google's Email address column", () => {
    const r = parseRegistrations([header, nino]);
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([{
      line: 2, email: "nino.m@btu.edu.ge", studentId: "BTU-T-0001", firstName: "Nino", lastName: "Maisuradze",
      program: "Computer Science", educationLevel: "Bachelor", errors: [],
    }]);
  });

  it("matches english-only titles in any order", () => {
    const r = parseRegistrations([["Last name", "Email", "First name", "Student ID", "Education level", "Program"], ["K", "g.k@btu.edu.ge", "G", "BTU-T-0002", "Master", "CS"]]);
    expect(r.rows[0]).toMatchObject({ email: "g.k@btu.edu.ge", firstName: "G", lastName: "K", studentId: "BTU-T-0002", educationLevel: "Master" });
  });

  it("same email twice keeps the later row", () => {
    const again = [...nino]; again[2] = "Nina";
    const r = parseRegistrations([header, nino, again]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ line: 3, firstName: "Nina" });
  });

  it("a gmail address is a row error", () => {
    const g = [...nino]; g[1] = "nino@gmail.com";
    expect(parseRegistrations([header, g]).rows[0]!.errors[0]).toContain("btu.edu.ge");
  });

  it("skips blank lines", () => {
    expect(parseRegistrations([header, nino, ["", "", ""]]).rows).toHaveLength(1);
  });

  it("a file without an email column is an error", () => {
    expect(parseRegistrations([["Name", "Student ID"], ["a", "b"]]).error).toContain("email");
  });
});

describe("names from the email", () => {
  it("splits first.last.N and capitalises", () => {
    expect(nameFromEmail("nika.loliashvili.1@btu.edu.ge")).toEqual({ firstName: "Nika", lastName: "Loliashvili" });
    expect(nameFromEmail("OtariTomas.Sepashvili.1@BTU.edu.ge")).toEqual({ firstName: "Otaritomas", lastName: "Sepashvili" });
    expect(nameFromEmail("nino.maisuradze@btu.edu.ge")).toEqual({ firstName: "Nino", lastName: "Maisuradze" });
  });

  it("keeps hyphenated names and extra parts in the last name", () => {
    expect(nameFromEmail("ana-maria.beridze.kvaratskhelia.2@btu.edu.ge")).toEqual({ firstName: "Ana-Maria", lastName: "Beridze Kvaratskhelia" });
  });

  it("gives no last name when the address has no dot", () => {
    expect(nameFromEmail("gkapanadze@btu.edu.ge")).toEqual({ firstName: "Gkapanadze", lastName: "" });
  });

  it("a form without name or id questions takes the names from the email", () => {
    const r = parseRegistrations([["Timestamp", "Email address", "პროგრამა / Program", "საფეხური / Education level"], ["x", "nika.loliashvili.1@btu.edu.ge", "Computer Science", "Bachelor's"]]);
    expect(r.rows[0]).toMatchObject({ email: "nika.loliashvili.1@btu.edu.ge", firstName: "Nika", lastName: "Loliashvili", studentId: "", errors: [] });
  });

  it("names a student typed win over the email", () => {
    const r = parseRegistrations([["Email address", "First name", "Last name"], ["nika.loliashvili.1@btu.edu.ge", "Nikoloz", "Loliashvili"]]);
    expect(r.rows[0]!.firstName).toBe("Nikoloz");
  });
});

describe("csv", () => {
  it("reads quoted fields with commas, quotes and line breaks", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([["a", "b, c", 'say "hi"'], ["1", "two\nlines", "3"]]);
  });

  it("drops a byte order mark", () => {
    expect(parseCsv("﻿Email address,x\n")).toEqual([["Email address", "x"]]);
  });
});
