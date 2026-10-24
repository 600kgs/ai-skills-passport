// an admin confirms or rejects a pending record. the decision goes into the sheet's
// status cell, so the sheet stays the one place btu's data lives; sync does the rest.
import { parseSheet, SHEET_HEADERS as H } from "@passport/core";
import type { SheetSource } from "./sheets.ts";

export type Decision = "CONFIRMED" | "REJECTED";

// the sheets api writes by cell position and can't "write only if this row is still that record", so a row
// inserted or deleted above it at the wrong moment would move the decision onto someone else's record.
// so: check right before writing (retry once if it moved), and right after (undo if it moved anyway)
export async function setRecordStatus(sheet: SheetSource, recordId: string, status: Decision, attempt = 1): Promise<{ row: number }> {
  const { row, col, recCol } = await locate(sheet, recordId);
  const stillThere = async () => (await sheet.read())[row - 1]?.[recCol]?.trim() === recordId;

  if (!(await stillThere())) {
    if (attempt < 2) return setRecordStatus(sheet, recordId, status, attempt + 1);
    throw new Error(`the sheet kept changing while ${recordId} was being decided; try again`);
  }
  await sheet.write([{ row, col, value: status }]);
  if (!(await stillThere())) {
    // whatever record sits there now goes back to blank, which means pending: a pending record is never issued
    await sheet.write([{ row, col, value: "" }]);
    throw new Error(`the sheet changed while ${recordId} was being decided, so nothing was decided; try again`);
  }
  return { row };
}

async function locate(sheet: SheetSource, recordId: string) {
  const grid = await sheet.read();
  const { columns, results } = await parseSheet(grid);
  const col = columns[H.verification];
  if (col === undefined) throw new Error("the sheet has no Verification Status column");
  const recCol = columns[H.recordId]!;

  const matches = results.filter((r) => r.recordId === recordId);
  if (matches.length !== 1) throw new Error(matches.length ? `${recordId} is on more than one row` : `${recordId} isn't in the sheet`);
  const { rowNumber } = matches[0]!;
  // only pending rows: an issued skill is frozen, and a rejection is final unless someone edits the sheet
  const current = (grid[rowNumber - 1]?.[col] ?? "").trim().toUpperCase() || "PENDING";
  if (current !== "PENDING") throw new Error(`${recordId} is ${current}, not PENDING`);
  return { row: rowNumber, col, recCol };
}
