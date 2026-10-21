// the google sheet behind an interface, so sync logic can be tested with a fake grid
import { auth as googleAuth, sheets as sheetsApi } from "@googleapis/sheets";

export type CellUpdate = { row: number; col: number; value: string }; // row 1-based, col 0-based

export interface SheetSource {
  read(): Promise<string[][]>;
  write(updates: CellUpdate[]): Promise<void>;
}

export const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function googleSheet(sheetId: string, keyFile: string): SheetSource {
  const auth = new googleAuth.GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const api = sheetsApi({ version: "v4", auth });
  let tab: string | undefined;

  const tabName = async () => {
    if (!tab) {
      const meta = await api.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties.title" });
      tab = meta.data.sheets?.[0]?.properties?.title ?? undefined;
      if (!tab) throw new Error("spreadsheet has no tabs");
    }
    return tab;
  };

  return {
    async read() {
      const res = await api.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${await tabName()}'`, valueRenderOption: "FORMATTED_VALUE" });
      return (res.data.values ?? []).map((r) => r.map((v) => String(v ?? "")));
    },
    async write(updates) {
      if (!updates.length) return;
      const t = await tabName();
      // one request for the whole batch keeps us far below the sheets api quota
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((u) => ({ range: `'${t}'!${colLetter(u.col)}${u.row}`, values: [[u.value]] })),
        },
      });
    },
  };
}
