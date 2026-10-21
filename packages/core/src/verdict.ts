// the brief's four outcomes, kept as two separate questions:
// does an official record exist (and is it the latest), and is this file that record?
import type { ChainRecord } from "./chain-read.ts";
import { equalBytes } from "./hash.ts";

export type RecordStatus = "unknown" | "latest" | "outdated" | "unconfirmed";
export type FileStatus = "not-checked" | "authentic" | "modified";
export type Outcome = "unknown" | "record-only" | "authentic-latest" | "authentic-outdated" | "modified";

export function verdict(input: {
  record: ChainRecord | null;
  latest: { isLatest: boolean } | null; // null when our server couldn't answer
  fileHash: Uint8Array | null;
}): { record: RecordStatus; file: FileStatus; outcome: Outcome } {
  if (!input.record) return { record: "unknown", file: "not-checked", outcome: "unknown" };
  const record: RecordStatus = !input.latest ? "unconfirmed" : input.latest.isLatest ? "latest" : "outdated";
  if (!input.fileHash) return { record, file: "not-checked", outcome: "record-only" };
  if (!equalBytes(input.fileHash, input.record.pdfSha256)) return { record, file: "modified", outcome: "modified" };
  return { record, file: "authentic", outcome: record === "outdated" ? "authentic-outdated" : "authentic-latest" };
}
