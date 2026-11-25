import { RECORDS_PER_PAGE, type RecordFilters } from "@passport/core";
import { and, type Db, desc, eq, passports, type SQL, skillAwards, sql, students } from "@passport/db";

// every passport with a confirmed skill not yet issued. the worker queues these on a timer, so an issue
// job lost between a page's write and its queue message still runs
export async function passportsWaitingToIssue(db: Db): Promise<string[]> {
  const rows = await db.selectDistinct({ passportId: passports.passportId }).from(skillAwards)
    .innerJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(eq(skillAwards.state, "pending"));
  return rows.map((r) => r.passportId).sort();
}

// a search term inside ilike, its own % and _ matched literally
const contains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listRecords(db: Db, f: RecordFilters) {
  const conds: SQL[] = [];
  if (f.q) {
    const like = contains(f.q);
    conds.push(sql`(${skillAwards.recordId} ilike ${like} or ${students.studentId} ilike ${like} or ${students.email} ilike ${like}
      or ${students.firstName} || ' ' || ${students.lastName} ilike ${like} or ${skillAwards.skillName} ilike ${like})`);
  }
  if (f.verification) conds.push(eq(skillAwards.verification, f.verification));
  if (f.state) conds.push(eq(skillAwards.state, f.state));
  if (f.source) conds.push(eq(skillAwards.source, f.source));
  if (f.workshop) conds.push(eq(skillAwards.workshopId, f.workshop));
  const where = conds.length ? and(...conds) : undefined;

  const [counted] = await db.select({ n: sql<number>`count(*)::int` }).from(skillAwards)
    .innerJoin(students, eq(students.studentId, skillAwards.studentId)).where(where);
  const total = counted?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / RECORDS_PER_PAGE));
  const page = Math.min(f.page, pages);
  const rows = await db.select({
    recordId: skillAwards.recordId, skillId: skillAwards.skillId, skillName: skillAwards.skillName, dateEarned: skillAwards.dateEarned,
    verification: skillAwards.verification, state: skillAwards.state, source: skillAwards.source, error: skillAwards.error,
    studentId: students.studentId, firstName: students.firstName, lastName: students.lastName, email: students.email,
    passportId: passports.passportId,
  })
    .from(skillAwards)
    .innerJoin(students, eq(students.studentId, skillAwards.studentId))
    .leftJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(where)
    // record ids grow with time; ordered by their number so REC-10000 lands after REC-9999
    .orderBy(desc(sql`coalesce(substring(${skillAwards.recordId} from '^REC-(\\d+)$')::int, 0)`), desc(skillAwards.recordId))
    .limit(RECORDS_PER_PAGE)
    .offset((page - 1) * RECORDS_PER_PAGE);
  return { rows, total, pages, page };
}

// the record form's student picker
export async function findStudents(db: Db, q: string, limit = 10) {
  const term = q.trim();
  if (!term) return [];
  const like = contains(term);
  return db.select({
    studentId: students.studentId, firstName: students.firstName, lastName: students.lastName, email: students.email,
    program: students.program, educationLevel: students.educationLevel, status: students.status, passportId: passports.passportId,
  })
    .from(students)
    .leftJoin(passports, eq(passports.studentId, students.studentId))
    .where(sql`(${students.studentId} ilike ${like} or ${students.email} ilike ${like} or ${students.firstName} || ' ' || ${students.lastName} ilike ${like})`)
    .orderBy(students.lastName, students.firstName)
    .limit(limit);
}

// one record with its student, for the edit page
export async function recordDetail(db: Db, recordId: string) {
  const [row] = await db.select({ award: skillAwards, student: students, passportId: passports.passportId })
    .from(skillAwards)
    .innerJoin(students, eq(students.studentId, skillAwards.studentId))
    .leftJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(eq(skillAwards.recordId, recordId));
  if (!row) return null;
  const [issued] = await db.execute<{ n: number }>(sql`select count(*)::int as n from passport_versions
    where passport_id = ${row.passportId} and state = 'issued'`).then((r) => r.rows);
  return { ...row, identityLocked: (issued?.n ?? 0) > 0 };
}
