// what the admin page asks the worker to do. the web app only queues these: the google
// key stays with the worker, off the internet-facing container
export const ADMIN_QUEUE = "admin-action";

export type AdminJob =
  | { kind: "sync"; by: string }
  | { kind: "set-status"; recordId: string; status: "CONFIRMED" | "REJECTED"; by: string }
  // grid = the uploaded sheet's cells as text, header row included
  | { kind: "import-preview"; grid: string[][]; by: string }
  | { kind: "import-apply"; grid: string[][]; fileName: string; by: string };

export type SyncResult = { newRecords: number; updatedRecords: number; failedRows: number; queued: number };

// line = the row number in the uploaded file, as excel shows it
export type ImportPreviewRow = { line: number; recordId: string; ok: boolean; errors: string[] };
export type ImportPreview = { rows: ImportPreviewRow[]; ignoredColumns: string[]; error?: string };
export type ImportResult = SyncResult & { added: string[]; skipped: number };

// the template's columns: the sheet's input columns, in its spelling. uploads are mapped by
// the live sheet's headers, so a column btu adds later (like Earned Through) works without a new template
export const UPLOAD_HEADERS = [
  "Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level",
  "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name",
  "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Verification Status",
] as const;
export const UPLOAD_MAX_ROWS = 500;
export const UPLOAD_MAX_BYTES = 1_000_000;
