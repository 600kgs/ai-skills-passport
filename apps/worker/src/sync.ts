// one sync run: sheet -> ledger -> status back into the sheet -> issue jobs.
// the ledger (postgres) is the truth. the sheet's status columns are recomputed
// from it every run, so a failed write-back simply heals on the next run.
import { parseSheet, SHEET_HEADERS as H, type SkillRecord } from "@passport/core";
import {
  auditLog, eq, inArray, passports, passportVersions, skillAwards, sql, students, syncRuns, type Db,
} from "@passport/db";
import type { CellUpdate, SheetSource } from "./sheets.ts";

export type SyncSummary = {
  skipped?: "locked";
  rowsSeen: number;
  newRecords: number;
  updatedRecords: number;
  failedRows: number;
  newPassports: number;
  queued: string[];
  cellsWritten: number;
};

type Status = "NOT SYNCED" | "SYNCED" | "FAILED";
type RowState = { status: Status; note: string; version: string; syncedAt: string; passportId?: string };

const fmtUtc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
const passportNo = (id: string | null | undefined) => Number(/^BTU-AI-(\d{6})$/.exec(id ?? "")?.[1] ?? 0);

export async function runSync(
  db: Db,
  sheet: SheetSource,
  opts: { trigger: "poll" | "manual"; enqueue: (passportId: string) => Promise<void>; today?: string },
): Promise<SyncSummary> {
  const grid = await sheet.read();
  const parsed = await parseSheet(grid);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const rowState = new Map<number, RowState>();
  const fail = (row: number, note: string, extra: Partial<RowState> = {}) =>
    rowState.set(row, { status: "FAILED", note, version: "", syncedAt: "", ...extra });

  for (const r of parsed.results) if (!r.ok) fail(r.rowNumber, r.errors.join("; "));
  const valid = parsed.results.flatMap((r) => (r.ok ? [r.record] : []));

  const result = await db.transaction(async (tx) => {
    // two workers must never sync at the same time
    const lock = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('passport-sync')) as locked`);
    if (!lock.rows[0]?.locked) return null;

    const knownStudents = new Map((await tx.select().from(students)).map((s) => [s.studentId, s]));
    const allPassports = await tx.select().from(passports);
    const passportOf = new Map(allPassports.map((p) => [p.studentId, p]));
    const ownerOfPassport = new Map(allPassports.map((p) => [p.passportId, p.studentId]));
    const ownerOfEmail = new Map([...knownStudents.values()].map((s) => [s.email.toLowerCase(), s.studentId]));
    const ids = valid.map((r) => r.recordId);
    const awards = new Map((ids.length ? await tx.select().from(skillAwards).where(inArray(skillAwards.recordId, ids)) : []).map((a) => [a.recordId, a]));
    const versionIds = [...awards.values()].flatMap((a) => (a.appliedInVersionId ? [a.appliedInVersionId] : []));
    const versions = new Map((versionIds.length ? await tx.select().from(passportVersions).where(inArray(passportVersions.id, versionIds)) : []).map((v) => [v.id, v]));

    // next free passport number: above everything in the ledger and in the sheet
    const passportCol = parsed.columns[H.passportId];
    let nextNo = Math.max(0, ...allPassports.map((p) => passportNo(p.passportId)),
      ...grid.map((r) => (passportCol === undefined ? 0 : passportNo(r[passportCol]))));

    let newRecords = 0, updatedRecords = 0, newPassports = 0;
    const audit: (typeof auditLog.$inferInsert)[] = [];

    const byStudent = new Map<string, SkillRecord[]>();
    for (const r of valid) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);

    for (const [studentId, recs] of byStudent) {
      const first = recs[0]!;
      const known = knownStudents.get(studentId);
      let passportId: string;

      if (known) {
        passportId = passportOf.get(studentId)!.passportId;
        const sameName = known.firstName === first.firstName && known.lastName === first.lastName;
        const sameEmail = known.email.toLowerCase() === first.email.toLowerCase();
        if (!sameName || !sameEmail) {
          recs.forEach((r) => fail(r.rowNumber, `name or email differs from the issued passport (${known.firstName} ${known.lastName}, ${known.email}); identity fields can't change`));
          continue;
        }
        if (first.passportId && first.passportId !== passportId) {
          recs.forEach((r) => fail(r.rowNumber, `Passport ID ${first.passportId} doesn't match this student's passport ${passportId}`));
          continue;
        }
        if (known.program !== first.program || known.educationLevel !== first.educationLevel || known.status !== first.studentStatus) {
          await tx.update(students).set({ program: first.program, educationLevel: first.educationLevel, status: first.studentStatus, updatedAt: new Date() })
            .where(eq(students.studentId, studentId));
        }
      } else {
        const emailOwner = ownerOfEmail.get(first.email.toLowerCase());
        if (emailOwner) {
          recs.forEach((r) => fail(r.rowNumber, `email ${first.email} already belongs to ${emailOwner}`));
          continue;
        }
        // keep the passport id btu already gave this student, else assign the next one
        passportId = first.passportId ?? `BTU-AI-${String(++nextNo).padStart(6, "0")}`;
        const owner = ownerOfPassport.get(passportId);
        if (owner) {
          recs.forEach((r) => fail(r.rowNumber, `Passport ID ${passportId} already belongs to ${owner}`));
          continue;
        }
        await tx.insert(students).values({
          studentId, firstName: first.firstName, lastName: first.lastName, email: first.email,
          program: first.program, educationLevel: first.educationLevel, status: first.studentStatus,
        });
        await tx.insert(passports).values({ passportId, studentId, firstIssued: first.firstIssued ?? today });
        ownerOfPassport.set(passportId, studentId);
        ownerOfEmail.set(first.email.toLowerCase(), studentId);
        newPassports++;
        audit.push({ actor: "system", action: "passport_created", subject: passportId, details: { studentId } });
      }

      for (const r of recs) {
        const award = awards.get(r.recordId);
        const wanted = r.verification === "CONFIRMED" ? "pending" : "ignored";
        const fields = {
          skillId: r.skillId, skillName: r.skillName, category: r.category, description: r.description,
          earnedThrough: r.earnedThrough, dateEarned: r.dateEarned, verification: r.verification, rowHash: r.rowHash,
        };

        if (!award) {
          await tx.insert(skillAwards).values({ recordId: r.recordId, studentId, ...fields, state: wanted });
          newRecords++;
          audit.push({ actor: "system", action: "award_recorded", subject: r.recordId, details: { studentId, state: wanted } });
          rowState.set(r.rowNumber, ignoredOrPending(wanted, r, passportId));
          continue;
        }
        if (award.studentId !== studentId) {
          fail(r.rowNumber, `Record ID ${r.recordId} already belongs to ${award.studentId}`);
          continue;
        }
        if (award.state === "applied") {
          const v = award.appliedInVersionId ? versions.get(award.appliedInVersionId) : undefined;
          const issued = { version: v ? `V${v.versionNo}` : "", syncedAt: v?.issuedAt ? fmtUtc(v.issuedAt) : "", passportId };
          if (award.rowHash !== r.rowHash) {
            // issued skills are frozen; the passport keeps what was confirmed at the time
            fail(r.rowNumber, "edited after it was issued; issued passports don't change. Restore the original values or add a new record", issued);
          } else {
            rowState.set(r.rowNumber, { status: "SYNCED", note: "", ...issued });
          }
          continue;
        }
        if (award.rowHash !== r.rowHash || award.state !== wanted) {
          await tx.update(skillAwards).set({ ...fields, state: wanted, error: null, updatedAt: new Date() }).where(eq(skillAwards.recordId, r.recordId));
          updatedRecords++;
          audit.push({ actor: "system", action: "award_updated", subject: r.recordId, details: { state: wanted } });
        }
        rowState.set(r.rowNumber, ignoredOrPending(wanted, r, passportId));
      }
    }

    // every passport still waiting on a confirmed skill gets a job, so missed jobs self-heal
    const queued = (await tx.selectDistinct({ passportId: passports.passportId }).from(skillAwards)
      .innerJoin(passports, eq(passports.studentId, skillAwards.studentId))
      .where(eq(skillAwards.state, "pending"))).map((p) => p.passportId);

    if (audit.length) await tx.insert(auditLog).values(audit);
    return { newRecords, updatedRecords, newPassports, queued };
  });

  if (!result) {
    return { skipped: "locked", rowsSeen: grid.length, newRecords: 0, updatedRecords: 0, failedRows: 0, newPassports: 0, queued: [], cellsWritten: 0 };
  }

  const updates = cellUpdates(grid, parsed.columns, rowState);
  await sheet.write(updates);
  for (const p of result.queued) await opts.enqueue(p);

  const failedRows = [...rowState.values()].filter((s) => s.status === "FAILED").length;
  await db.insert(syncRuns).values({
    trigger: opts.trigger, finishedAt: new Date(), rowsSeen: grid.length,
    newRecords: result.newRecords, failedRecords: failedRows,
  });
  return { rowsSeen: grid.length, ...result, failedRows, cellsWritten: updates.length };
}

function ignoredOrPending(state: "pending" | "ignored", r: SkillRecord, passportId: string): RowState {
  const note = state === "ignored" ? `status ${r.verification}: not added to the passport` : "";
  return { status: "NOT SYNCED", note, version: "", syncedAt: "", passportId };
}

// only cells whose value actually changes, so a quiet run writes nothing
function cellUpdates(grid: string[][], columns: Record<string, number>, rows: Map<number, RowState>): CellUpdate[] {
  const out: CellUpdate[] = [];
  const set = (row: number, header: string, value: string | undefined) => {
    const col = columns[header];
    if (col === undefined || value === undefined) return;
    if ((grid[row - 1]?.[col] ?? "").trim() !== value) out.push({ row, col, value });
  };
  for (const [row, s] of rows) {
    set(row, H.syncStatus, s.status);
    set(row, H.syncedVersion, s.version);
    set(row, H.syncedAt, s.syncedAt);
    set(row, H.syncError, s.note);
    set(row, H.passportId, s.passportId);
  }
  return out;
}
