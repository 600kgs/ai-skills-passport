import "server-only";
import { normHeader, RECORD_UPLOAD_HEADERS } from "@passport/core";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";

// excel's own date cells become YYYY-MM-DD, the format the sheet uses; everything else is text
const text = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v));

// the first tab that has the header row; a workbook with a cover or notes tab still works
export async function readUpload(bytes: Buffer): Promise<string[][] | null> {
  const sheets = await readXlsxFile(bytes);
  for (const { data } of sheets) {
    const grid = data.map((row) => row.map(text));
    if (grid.some((r) => r.map(normHeader).includes("student id") && r.map(normHeader).includes("skill id"))) return grid;
  }
  return null;
}

export async function uploadTemplate(): Promise<Buffer> {
  return writeXlsxFile([RECORD_UPLOAD_HEADERS.map((value) => ({ value, fontWeight: "bold" as const }))], {
    sheet: "Skill records",
    columns: RECORD_UPLOAD_HEADERS.map((h) => ({ width: Math.max(14, h.length + 4) })),
    stickyRowsCount: 1,
  }).toBuffer();
}

// a header row and plain rows; numbers and dates go in as text so ids and dates keep their exact form
export async function tableXlsx(sheet: string, header: string[], rows: (string | number | null)[][]): Promise<Buffer> {
  const data = [header.map((value) => ({ value, fontWeight: "bold" as const })), ...rows.map((r) => r.map((v) => ({ value: v == null ? "" : String(v) })))];
  return writeXlsxFile(data, { sheet, columns: header.map((h) => ({ width: Math.max(14, h.length + 4) })), stickyRowsCount: 1 }).toBuffer();
}
