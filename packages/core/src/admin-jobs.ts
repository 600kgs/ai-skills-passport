// what the admin page asks the worker to do. the web app only queues these: the google
// key stays with the worker, off the internet-facing container
export const ADMIN_QUEUE = "admin-action";

export type AdminJob =
  | { kind: "sync"; by: string }
  | { kind: "set-status"; recordId: string; status: "CONFIRMED" | "REJECTED"; by: string };

export type AdminJobResult = { newRecords: number; updatedRecords: number; failedRows: number; queued: number };
