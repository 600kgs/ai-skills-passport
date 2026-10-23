// an admin's excel upload, checked against the live sheet. the rows are validated as if they
// were already appended under the sheet's last record, by the same parser sync uses, so
// "valid here" means "sync will take it": duplicates and identity clashes included.
import { normHeader, parseSheet, SHEET_HEADERS as H, type ImportPreview, UPLOAD_MAX_ROWS } from "@passport/core";

// sync writes these; whatever a file says in them is dropped
const SYSTEM = new Set<string>([H.syncStatus, H.syncedVersion, H.syncedAt, H.syncError]);

export type ImportPlan = {
  preview: ImportPreview;
  // the sheet row the new rows go in front of: right under the last record, above btu's notes
  insertAt: number;
  // the valid rows, as full sheet rows in the sheet's column order
  valid: { recordId: string; values: string[] }[];
};

const failed = (error: string, insertAt = 0): ImportPlan => ({ preview: { rows: [], ignoredColumns: [], error }, insertAt, valid: [] });

export async function planImport(sheetGrid: string[][], upload: string[][]): Promise<ImportPlan> {
  const sheet = await parseSheet(sheetGrid);
  const sheetHeader = sheetGrid[sheet.headerRow - 1]!.map(normHeader);
  const lastRecordRow = Math.max(sheet.headerRow, ...sheet.results.map((r) => r.rowNumber));
  const insertAt = lastRecordRow + 1;

  const headerIdx = upload.findIndex((r) => r.map(normHeader).includes(H.recordId) && r.map(normHeader).includes(H.studentId));
  if (headerIdx < 0) return failed("The file needs a header row with Student ID and Record ID. Start from the template.", insertAt);
  const fileHeader = upload[headerIdx]!;
  const fileCol = new Map<string, number>();
  fileHeader.forEach((h, i) => { if (normHeader(h) && !fileCol.has(normHeader(h))) fileCol.set(normHeader(h), i); });
  const ignoredColumns = fileHeader.filter((h) => normHeader(h) && !sheetHeader.includes(normHeader(h)) && !SYSTEM.has(normHeader(h)));
  const hasStatus = fileCol.has(H.verification);
  // a known student's passport id and first-issued date come from the sheet when the file leaves them blank
  const known = new Map(sheet.results.flatMap((r) => (r.ok && r.record.passportId
    ? [[r.record.studentId, { [H.passportId]: r.record.passportId, [H.firstIssued]: r.record.firstIssued ?? "" }] as const] : [])));

  const lines: { line: number; values: string[] }[] = [];
  for (const [i, r] of upload.slice(headerIdx + 1).entries()) {
    const get = (h: string) => (fileCol.has(h) ? String(r[fileCol.get(h)!] ?? "").trim() : "");
    // same rule as the sheet: a row without an id or skill data is a note, not a record
    if (!get(H.recordId) && !get(H.skillId) && !get(H.skillName)) continue;
    const student = known.get(get(H.studentId)) as Record<string, string> | undefined;
    lines.push({
      line: headerIdx + 2 + i,
      values: sheetHeader.map((h) => {
        if (SYSTEM.has(h)) return "";
        // no status column in the file means confirmed, exactly like a sheet without one
        if (h === H.verification && !hasStatus) return "CONFIRMED";
        return get(h) || (student?.[h] ?? "");
      }),
    });
  }
  if (!lines.length) return failed("There are no records under the header row.", insertAt);
  if (lines.length > UPLOAD_MAX_ROWS) return failed(`The file has ${lines.length} records; upload at most ${UPLOAD_MAX_ROWS} at a time.`, insertAt);

  const combined = await parseSheet([...sheetGrid.slice(0, lastRecordRow), ...lines.map((l) => l.values)]);
  const lineOf = (row: number) => lines[row - insertAt]?.line;
  const rows = combined.results.filter((r) => r.rowNumber >= insertAt).map((r) => {
    const line = lineOf(r.rowNumber)!;
    // the parser counts rows in the combined grid; point at the file's own lines instead
    const errors = r.ok ? [] : r.errors.map((e) => e.replace(/\(first on row (\d+)\)/, (m, n: string) =>
      Number(n) >= insertAt ? `(first on line ${lineOf(Number(n))} of this file)` : `(already on row ${n} of the sheet)`));
    return { line, recordId: r.recordId, ok: r.ok, errors };
  });
  const valid = rows.flatMap((r, i) => (r.ok ? [{ recordId: r.recordId, values: lines[i]!.values }] : []));
  return { preview: { rows, ignoredColumns }, insertAt, valid };
}
