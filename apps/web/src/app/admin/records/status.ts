import { fill } from "@/i18n/format";

// one line for a record's state, the same on the list and the record page
export function recordStatus(states: Record<string, string>, r: { verification: string; state: string; versionNo: number | null }): string {
  if (r.verification === "PENDING" && r.state === "ignored") return states.awaiting!;
  if (r.verification === "REJECTED") return states.rejected!;
  if (r.state === "applied") return fill(states.applied!, { n: r.versionNo ?? "?" });
  return states[r.state] ?? r.state;
}
