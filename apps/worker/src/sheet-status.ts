// an admin confirms or rejects a pending record. the decision goes into the sheet's
// status cell, so the sheet stays the one place btu's data lives; sync does the rest.
import { parseSheet, SHEET_HEADERS as H } from "@passport/core";
import type { SheetSource } from "./sheets.ts";

export type Decision = "CONFIRMED" | "REJECTED";

export async function setRecordStatus(sheet: SheetSource, recordId: string, status: Decision): Promise<{ row: number }> {
  const grid = await sheet.read();
  const { columns, results } = await parseSheet(grid);
  const col = columns[H.verification];
  if (col === undefined) throw new Error("the sheet has no Verification Status column");

  const matches = results.filter((r) => r.recordId === recordId);
  if (matches.length !== 1) throw new Error(matches.length ? `${recordId} is on more than one row` : `${recordId} isn't in the sheet`);
  const { rowNumber } = matches[0]!;
  // only pending rows: an issued skill is frozen, and a rejection is final unless someone edits the sheet
  const current = (grid[rowNumber - 1]?.[col] ?? "").trim().toUpperCase() || "PENDING";
  if (current !== "PENDING") throw new Error(`${recordId} is ${current}, not PENDING`);

  await sheet.write([{ row: rowNumber, col, value: status }]);
  return { row: rowNumber };
}
