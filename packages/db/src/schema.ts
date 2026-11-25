// the issuance ledger. rows here are the source of truth for what was issued;
// the google sheet is only the input, and the chain only holds hashes.
import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// deleted = removed by staff before issue; withdrawn = taken out by a revoke because it was a mistake. issue skips both
export const awardState = pgEnum("award_state", ["pending", "applied", "failed", "ignored", "conflict", "deleted", "withdrawn"]);
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
  // where the record came from, who made it and who confirmed or rejected it
  source: text("source").notNull().default("sheet"),
  workshopId: integer("workshop_id").references((): AnyPgColumn => workshops.id),
  createdBy: text("created_by"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("skill_awards_student_idx").on(t.studentId),
  check("skill_awards_source", sql`${t.source} in ('sheet', 'web', 'excel', 'workshop')`),
]);

export type VersionSkill = {
  recordId: string; rowHash: string; verification: string; skillName: string; category: string;
  description: string; earnedThrough: string | null; dateEarned: string;
};

export const passportVersions = pgTable("passport_versions", {
  id: serial("id").primaryKey(),
  passportId: text("passport_id").notNull().references(() => passports.passportId),
  versionNo: integer("version_no").notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  state: versionState("state").notNull().default("rendering"),
  skillCount: integer("skill_count").notNull(),
  // exactly which award records this version contains, fixed when the version is created
  includedRecordIds: text("included_record_ids").array().notNull().default(sql`'{}'::text[]`),
  // and what those records said at that moment: the pdf is rendered from this, never from the live rows.
  // null on versions issued before it existed
  skills: jsonb("skills").$type<VersionSkill[]>(),
  pdfSha256: text("pdf_sha256"),
  pdfPath: text("pdf_path"),
  attestationAddress: text("attestation_address"),
  txSignature: text("tx_signature"),
  signer: text("signer"),
  error: text("error"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  // set by scripts/revoke.ts: the version stays in the ledger, its chain record is closed
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokeReason: text("revoke_reason"),
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

// the skills staff can award. an award copies the texts when it is made, so editing a skill here
// never changes a record or an issued passport
export const skills = pgTable("skills", {
  skillId: text("skill_id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// workshops and hackathons staff list on the public site. times are stored as instants and shown in tbilisi time
export const workshops = pgTable("workshops", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description").notNull(),
  descriptionEn: text("description_en"),
  trainer: text("trainer").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location").notNull(),
  // the badge it gives; null for an event without one
  skillId: text("skill_id").references(() => skills.skillId),
  registrationUrl: text("registration_url").notNull(),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("workshops_kind", sql`${t.kind} in ('workshop', 'hackathon')`),
  check("workshops_status", sql`${t.status} in ('draft', 'published', 'cancelled')`),
  index("workshops_starts_idx").on(t.startsAt),
]);

// who registered for a workshop, from the outside form's export; passed is ticked by staff afterwards
export const workshopRegistrations = pgTable("workshop_registrations", {
  id: serial("id").primaryKey(),
  workshopId: integer("workshop_id").notNull().references(() => workshops.id),
  email: text("email").notNull(), // lowercased
  studentId: text("student_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  program: text("program").notNull(),
  educationLevel: text("education_level").notNull(),
  passed: boolean("passed").notNull().default(false),
  // the skill record made for this student, once staff created records for the ticked rows
  recordId: text("record_id"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("workshop_registrations_email_idx").on(t.workshopId, t.email)]);

// btu staff who may use the admin pages, by role. ADMIN_EMAILS from the server config are superadmins on top of these
export const staffRole = pgEnum("staff_role", ["viewer", "editor", "admin", "superadmin"]);

export const staff = pgTable("staff", {
  email: text("email").primaryKey(), // lowercased
  role: staffRole("role").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// one permanent public link per student skill, for linkedin. the code is random like a version code,
// so links can't be walked the way sequential passport and skill ids could
export const skillLinks = pgTable("skill_links", {
  code: text("code").primaryKey(),
  passportId: text("passport_id").notNull().references(() => passports.passportId),
  skillId: text("skill_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("skill_links_skill_idx").on(t.passportId, t.skillId)]);
