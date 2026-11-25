// every write to the ledger runs in one transaction under the lock the issue job also takes,
// so a skill can't change while a version with it is being frozen and put on chain
import { type Db, sql } from "@passport/db";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type LedgerResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): LedgerResult<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): LedgerResult<T> => ({ ok: false, error });

export function withLedgerLock<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('passport-sync'))`);
    return fn(tx);
  });
}
