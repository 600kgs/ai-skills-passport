// a workshop's registration list, as exported from its google form (xlsx or csv).
// question titles vary ("სახელი / First name (Latin letters)"), so a column belongs to a field when its title contains one of the field's names
import { isBtuAccount } from "./access.ts";
import { normHeader } from "./records.ts";

export const REGISTRATION_FIELDS = {
  email: ["email address", "email", "ელ-ფოსტა", "ელფოსტა"],
  studentId: ["student id", "სტუდენტის id"],
  firstName: ["first name", "სახელი"],
  lastName: ["last name", "გვარი"],
  program: ["program", "პროგრამა"],
  educationLevel: ["education level", "საფეხური"],
} as const;
type Field = keyof typeof REGISTRATION_FIELDS;

export type RegistrationRow = {
  line: number; email: string; studentId: string; firstName: string; lastName: string;
  program: string; educationLevel: string; errors: string[];
};

// each field takes the first column whose title contains one of its names, longest names tried first,
// and a column serves one field only
function columnsOf(header: string[]): Partial<Record<Field, number>> {
  const titles = header.map(normHeader);
  const pairs = (Object.entries(REGISTRATION_FIELDS) as [Field, readonly string[]][])
    .flatMap(([field, names]) => names.map((name) => ({ field, name })))
    .sort((a, b) => b.name.length - a.name.length);
  const cols: Partial<Record<Field, number>> = {};
  const taken = new Set<number>();
  for (const { field, name } of pairs) {
    if (cols[field] !== undefined) continue;
    const i = titles.findIndex((t, idx) => !taken.has(idx) && t.includes(name));
    if (i >= 0) { cols[field] = i; taken.add(i); }
  }
  return cols;
}

const cap = (w: string) => w.split("-").map((p) => (p ? p[0]!.toUpperCase() + p.slice(1).toLowerCase() : p)).join("-");

// btu addresses are first.last, sometimes with a number (nika.loliashvili.1). a guess: double first names come out
// glued ("otaritomas"), so staff check it before the first version is issued
export function nameFromEmail(email: string): { firstName: string; lastName: string } {
  const parts = email.trim().split("@")[0]!.split(".").filter((p) => p && !/^\d+$/.test(p));
  return { firstName: cap(parts[0] ?? ""), lastName: parts.slice(1).map(cap).join(" ") };
}

export function parseRegistrations(grid: string[][]): { rows: RegistrationRow[]; error?: string } {
  const headerIdx = grid.findIndex((r) => columnsOf(r).email !== undefined);
  if (headerIdx < 0) return { rows: [], error: "The file has no email column. Export the form's responses with \"Collect email addresses\" turned on." };
  const cols = columnsOf(grid[headerIdx]!);
  const byEmail = new Map<string, RegistrationRow>();
  for (const [i, r] of grid.slice(headerIdx + 1).entries()) {
    const get = (f: Field) => (cols[f] === undefined ? "" : String(r[cols[f]!] ?? "").trim());
    const email = get("email").toLowerCase();
    if (!email && !get("studentId") && !get("firstName")) continue;
    const errors = isBtuAccount({ email, emailVerified: true }) ? [] : [`"${get("email")}" isn't a btu.edu.ge address`];
    // the newest answer from the same person wins
    byEmail.delete(email);
    // the form may not ask for names at all; then they come from the address
    const guess = nameFromEmail(email);
    byEmail.set(email, {
      line: headerIdx + 2 + i, email, studentId: get("studentId"),
      firstName: get("firstName") || guess.firstName, lastName: get("lastName") || guess.lastName,
      program: get("program"), educationLevel: get("educationLevel"), errors,
    });
  }
  return { rows: [...byEmail.values()] };
}

// a small csv reader for google's export: quoted fields, doubled quotes, line breaks inside quotes
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
