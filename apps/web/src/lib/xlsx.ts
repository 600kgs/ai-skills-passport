import "server-only";
import { normHeader, SHEET_HEADERS as H, UPLOAD_HEADERS } from "@passport/core";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";

// excel's own date cells become YYYY-MM-DD, the format the sheet uses; everything else is text
const text = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v));

// the first tab that has the header row; a workbook with a cover or notes tab still works
export async function readUpload(bytes: Buffer): Promise<string[][] | null> {
  const sheets = await readXlsxFile(bytes);
  for (const { data } of sheets) {
    const grid = data.map((row) => row.map(text));
    if (grid.some((r) => r.map(normHeader).includes(H.recordId) && r.map(normHeader).includes(H.studentId))) return grid;
  }
  return null;
}

export async function uploadTemplate(): Promise<Buffer> {
  return writeXlsxFile([UPLOAD_HEADERS.map((value) => ({ value, fontWeight: "bold" as const }))], {
    sheet: "Passport Skill Records",
    columns: UPLOAD_HEADERS.map((h) => ({ width: Math.max(14, h.length + 4) })),
    stickyRowsCount: 1,
  }).toBuffer();
}
