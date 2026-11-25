// a real postgres for the ledger tests. its own database: the worker's tests truncate passport_test,
// and pnpm runs both packages' tests at the same time
import { createDb, type Db, sql } from "@passport/db";
import { runMigrations } from "@passport/db/migrate";
import pg from "pg";

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport";
const TEST_URL = process.env.TEST_LEDGER_DATABASE_URL ?? "postgres://passport:passport@localhost:5433/passport_ledger_test";

export async function setupLedgerDb(): Promise<{ db: Db; pool: pg.Pool }> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  if (!(await admin.query("select 1 from pg_database where datname = 'passport_ledger_test'")).rowCount) {
    await admin.query("create database passport_ledger_test");
  }
  await admin.end();
  const { db, pool } = createDb(TEST_URL);
  await runMigrations(db);
  return { db, pool };
}

// every table the app writes, emptied between tests
export async function resetLedgerDb(db: Db) {
  const { rows } = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}
