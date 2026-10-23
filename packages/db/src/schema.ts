// the issuance ledger. rows here are the source of truth for what was issued;
// the google sheet is only the input, and the chain only holds hashes.
import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const awardState = pgEnum("award_state", ["pending", "applied", "failed", "ignored", "conflict"]);
export const versionState = pgEnum("version_state", ["rendering", "anchoring", "issued", "failed"]);

export const students = pgTable("students", {
  studentId: text("student_id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  program: text("program").notNull(),
  educationLevel: text("education_level").notNull(),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("students_email_idx").on(sql`lower(${t.email})`)]);

export const passports = pgTable("passports", {
  passportId: text("passport_id").primaryKey(),
  // unique: one student can never end up with two passports
  studentId: text("student_id").notNull().unique().references(() => students.studentId),
  firstIssued: date("first_issued").notNull(),
  // only set once a version is issued and anchored on chain
  latestVersionId: integer("latest_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// one row per record id from the sheet. skill fields are a snapshot of what was
// confirmed, so later catalog edits never change an issued passport.
export const skillAwards = pgTable("skill_awards", {
  recordId: text("record_id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.studentId),
  skillId: text("skill_id").notNull(),
  skillName: text("skill_name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  earnedThrough: text("earned_through"),
  dateEarned: date("date_earned").notNull(),
  verification: text("verification").notNull(),
  rowHash: text("row_hash").notNull(),
  state: awardState("state").notNull().default("pending"),
  error: text("error"),
  appliedInVersionId: integer("applied_in_version_id"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("skill_awards_student_idx").on(t.studentId)]);

export const passportVersions = pgTable("passport_versions", {
  id: serial("id").primaryKey(),
  passportId: text("passport_id").notNull().references(() => passports.passportId),
  versionNo: integer("version_no").notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  state: versionState("state").notNull().default("rendering"),
  skillCount: integer("skill_count").notNull(),
  // exactly which award records this version contains, fixed when the version is created
  includedRecordIds: text("included_record_ids").array().notNull().default(sql`'{}'::text[]`),
  pdfSha256: text("pdf_sha256"),
  pdfPath: text("pdf_path"),
  attestationAddress: text("attestation_address"),
  txSignature: text("tx_signature"),
  signer: text("signer"),
  error: text("error"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("passport_versions_no_idx").on(t.passportId, t.versionNo),
  check("issued_has_proof", sql`${t.state} <> 'issued' or (${t.pdfSha256} is not null and ${t.txSignature} is not null)`),
]);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(), // "poll" | "manual"
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  rowsSeen: integer("rows_seen"),
  newRecords: integer("new_records"),
  failedRecords: integer("failed_records"),
  // the sheet rows sync couldn't take, with the reason; what the admin page lists to fix
  problems: jsonb("problems").$type<{ row: number; recordId: string; note: string }[]>(),
  error: text("error"),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(), // "system" or an admin email
  action: text("action").notNull(),
  subject: text("subject"),
  details: jsonb("details"),
});
