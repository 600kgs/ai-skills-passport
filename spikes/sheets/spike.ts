// test of the google sheets side: read btu's records through a service account,
// map columns by header name (not position), validate every row, and prove we
// can write sync status back into the system-managed columns.
import { createHash } from "node:crypto";
import { auth as googleAuth, sheets as sheetsApi } from "@googleapis/sheets";

try {
  process.loadEnvFile(); // SHEET_ID lives in .env (gitignored)
} catch {}

const SHEET_ID = process.env.SHEET_ID;
const KEY_FILE = ".keys/service-account.json";
if (!SHEET_ID) throw new Error("set SHEET_ID in spikes/sheets/.env");

const REQUIRED = [
  "student id", "first name", "last name", "btu email (test)", "program", "education level",
  "passport id (existing)", "first issued (existing)", "student status", "record id", "skill id",
  "skill name", "skill category", "skill description", "date earned", "passport sync status",
];
const OPTIONAL = ["badge/stamp code", "verification status", "earned through",
  "synced passport version", "synced at (utc)", "sync error / notes"];
const STAMP_BY_CATEGORY: Record<string, string> = {
  "AI Skill": "BDG-AI-001", "AI Applied Skill": "BDG-AI-002", "AI Advanced Skill": "BDG-AI-003",
};
// fields that must agree on every row of the same student
const STUDENT_FIELDS = ["first name", "last name", "btu email (test)", "passport id (existing)", "first issued (existing)"];

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

async function main() {
  const auth = new googleAuth.GoogleAuth({ keyFile: KEY_FILE, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const api = sheetsApi({ version: "v4", auth });

  const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tab = meta.data.sheets![0].properties!.title!;
  console.log(`spreadsheet: "${meta.data.properties?.title}", tab: "${tab}"`);

  let t = Date.now();
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tab}'`, valueRenderOption: "FORMATTED_VALUE" });
  const readMs = Date.now() - t;
  const rows = res.data.values ?? [];

  // the header row is wherever "record id" and "student id" appear, not a fixed row number
  const headerIdx = rows.findIndex((r) => r.map(norm).includes("record id") && r.map(norm).includes("student id"));
  if (headerIdx < 0) throw new Error("no header row with Student ID and Record ID");
  const col: Record<string, number> = {};
  rows[headerIdx].forEach((h, i) => (col[norm(h)] = i));
  const missing = REQUIRED.filter((h) => col[h] === undefined);
  if (missing.length) throw new Error(`missing columns: ${missing.join(", ")}`);
  console.log(`header on row ${headerIdx + 1}, optional columns present: ${OPTIONAL.filter((h) => col[h] !== undefined).join(", ") || "none"}`);

  const get = (r: string[], h: string) => String(r[col[h]] ?? "").trim();
  const errors: string[] = [];
  const seen = new Map<string, number>();
  const students = new Map<string, Record<string, string>>();
  const statuses: Record<string, number> = {};
  const hashes: string[] = [];
  let records = 0;

  rows.slice(headerIdx + 1).forEach((r, i) => {
    const rowNo = headerIdx + 2 + i;
    // notes below the table only fill column a. a record has a record id or
    // skill data, so a row with a typo'd id still gets validated, not skipped
    if (!get(r, "record id") && !get(r, "skill id") && !get(r, "skill name")) return;
    records++;
    const err = (m: string) => errors.push(`row ${rowNo}: ${m}`);

    const empty = REQUIRED.filter((h) => h !== "passport sync status" && !get(r, h));
    if (empty.length) err(`empty ${empty.join(", ")}`);
    if (!/^REC-\d+$/.test(get(r, "record id"))) err(`bad record id "${get(r, "record id")}"`);
    if (!/^BTU-T-\d+$/.test(get(r, "student id"))) err(`bad student id "${get(r, "student id")}"`);
    for (const h of ["date earned", "first issued (existing)"]) {
      if (get(r, h) && !/^\d{4}-\d{2}-\d{2}$/.test(get(r, h))) err(`${h} not yyyy-mm-dd: "${get(r, h)}"`);
    }
    const cat = get(r, "skill category");
    if (cat && !STAMP_BY_CATEGORY[cat]) err(`unknown category "${cat}"`);
    if (col["badge/stamp code"] !== undefined && cat && get(r, "badge/stamp code") !== STAMP_BY_CATEGORY[cat]) {
      err(`stamp ${get(r, "badge/stamp code")} doesn't match category ${cat}`);
    }
    if (col["verification status"] !== undefined && !["CONFIRMED", "PENDING", "REJECTED"].includes(get(r, "verification status"))) {
      err(`verification status "${get(r, "verification status")}"`);
    }

    const rid = get(r, "record id");
    if (seen.has(rid)) err(`duplicate record id ${rid} (first on row ${seen.get(rid)})`);
    else seen.set(rid, rowNo);

    const sid = get(r, "student id");
    const facts = Object.fromEntries(STUDENT_FIELDS.map((h) => [h, get(r, h)]));
    const known = students.get(sid);
    if (!known) students.set(sid, facts);
    else for (const h of STUDENT_FIELDS) if (known[h] !== facts[h]) err(`${sid} ${h} "${facts[h]}" disagrees with "${known[h]}"`);

    const st = get(r, "passport sync status") || "(empty)";
    statuses[st] = (statuses[st] ?? 0) + 1;
    // content hash of the input columns, used later to spot rows edited after processing
    hashes.push(createHash("sha256").update(REQUIRED.slice(0, 15).map((h) => get(r, h)).join("\u0001")).digest("hex").slice(0, 12));
  });

  console.log(`\nread ${rows.length} rows in ${readMs} ms -> ${records} records, ${students.size} students`);
  console.log(`sync status: ${Object.entries(statuses).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`row hash example: ${hashes[0]}`);
  console.log(errors.length ? `\n${errors.length} problems:\n  ${errors.slice(0, 15).join("\n  ")}` : "\nall records valid");

  // write-back test on the first record's notes cell, then restore it
  const notesCol = col["sync error / notes"];
  if (notesCol === undefined) return console.log("\nno 'Sync Error / Notes' column, skipping write test");
  const cell = `'${tab}'!${colLetter(notesCol)}${headerIdx + 2}`;
  const original = String(rows[headerIdx + 1]?.[notesCol] ?? "");
  const stamp = `sheets test ${new Date().toISOString()}`;
  t = Date.now();
  await api.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: cell, valueInputOption: "RAW", requestBody: { values: [[stamp]] } });
  const back = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: cell });
  const ok = back.data.values?.[0]?.[0] === stamp;
  await api.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: cell, valueInputOption: "RAW", requestBody: { values: [[original]] } });
  console.log(`\nwrite-back to ${cell}: ${ok ? "OK" : "FAILED"} (${Date.now() - t} ms, restored)`);
}

main().catch((e) => {
  const msg = (e as { errors?: { message: string }[] }).errors?.[0]?.message ?? (e as Error).message;
  console.error(`failed: ${msg}`);
  process.exit(1);
});
