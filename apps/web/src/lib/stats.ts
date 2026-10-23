import "server-only";
import { sql } from "@passport/db";
import { getDb } from "@/lib/db";

// totals for the home page; counts only, nothing about any one student
export async function publicStats(): Promise<{ passports: number; versions: number; skills: number } | null> {
  try {
    const [row] = (await getDb().execute<{ passports: number; versions: number; skills: number }>(sql`
      select (select count(*) from passports where latest_version_id is not null)::int as passports,
             (select count(*) from passport_versions where state = 'issued')::int as versions,
             (select count(*) from skill_awards where state = 'applied')::int as skills`)).rows;
    return row ?? null;
  } catch {
    return null; // the page still works without them
  }
}
