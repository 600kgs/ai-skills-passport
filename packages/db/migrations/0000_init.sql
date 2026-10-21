CREATE TYPE "public"."award_state" AS ENUM('pending', 'applied', 'failed', 'ignored', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."version_state" AS ENUM('rendering', 'anchoring', 'issued', 'failed');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "passport_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"passport_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"verification_code" text NOT NULL,
	"state" "version_state" DEFAULT 'rendering' NOT NULL,
	"skill_count" integer NOT NULL,
	"pdf_sha256" text,
	"pdf_path" text,
	"attestation_address" text,
	"tx_signature" text,
	"signer" text,
	"error" text,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passport_versions_verification_code_unique" UNIQUE("verification_code"),
	CONSTRAINT "issued_has_proof" CHECK ("passport_versions"."state" <> 'issued' or ("passport_versions"."pdf_sha256" is not null and "passport_versions"."tx_signature" is not null))
);
--> statement-breakpoint
CREATE TABLE "passports" (
	"passport_id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"first_issued" date NOT NULL,
	"latest_version_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passports_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "skill_awards" (
	"record_id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"skill_name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"earned_through" text,
	"date_earned" date NOT NULL,
	"verification" text NOT NULL,
	"row_hash" text NOT NULL,
	"state" "award_state" DEFAULT 'pending' NOT NULL,
	"error" text,
	"applied_in_version_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"program" text NOT NULL,
	"education_level" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_seen" integer,
	"new_records" integer,
	"failed_records" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "passport_versions" ADD CONSTRAINT "passport_versions_passport_id_passports_passport_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."passports"("passport_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD CONSTRAINT "skill_awards_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "passport_versions_no_idx" ON "passport_versions" USING btree ("passport_id","version_no");--> statement-breakpoint
CREATE INDEX "skill_awards_student_idx" ON "skill_awards" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_email_idx" ON "students" USING btree (lower("email"));