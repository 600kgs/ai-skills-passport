import "server-only";
import { createDb, type Db } from "@passport/db";

// one pool per server process, also across dev hot reloads
const g = globalThis as unknown as { passportDb?: Db };
export const db: Db = (g.passportDb ??= createDb().db);
