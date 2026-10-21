import "server-only";
import { createDb, type Db } from "@passport/db";

// connect on first use, not at import: `next build` loads every route without a database.
// one pool per server process, also across dev hot reloads
const g = globalThis as unknown as { passportDb?: Db };
export const getDb = (): Db => (g.passportDb ??= createDb().db);
