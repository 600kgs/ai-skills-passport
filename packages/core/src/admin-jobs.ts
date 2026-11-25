// what the admin pages ask the worker to do. the web app only queues these: the issuer key
// stays with the worker, off the internet-facing container
export const ADMIN_QUEUE = "admin-action";
// one job per passport that has confirmed skills waiting; the worker owns the queue
export const ISSUE_QUEUE = "issue-passport";

// withdraw = record ids first added in that version that were the mistake
export type AdminJob = { kind: "revoke"; code: string; reason: string; withdraw: string[]; by: string };
export type RevokeResult = { passportId: string; versionNo: number; chainClosed: boolean; withdrawn: string[]; reissue: boolean };

export const UPLOAD_MAX_ROWS = 500;
export const UPLOAD_MAX_BYTES = 1_000_000;
