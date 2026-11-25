import { type Db, eq, passports, skillAwards } from "@passport/db";

// every passport with a confirmed skill not yet issued. the worker queues these on a timer, so an issue
// job lost between a page's write and its queue message still runs
export async function passportsWaitingToIssue(db: Db): Promise<string[]> {
  const rows = await db.selectDistinct({ passportId: passports.passportId }).from(skillAwards)
    .innerJoin(passports, eq(passports.studentId, skillAwards.studentId))
    .where(eq(skillAwards.state, "pending"));
  return rows.map((r) => r.passportId).sort();
}
