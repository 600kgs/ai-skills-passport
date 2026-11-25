ALTER TABLE "skill_awards" ADD COLUMN "source" text DEFAULT 'sheet' NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD COLUMN "workshop_id" integer;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skill_awards" ADD CONSTRAINT "skill_awards_source" CHECK ("skill_awards"."source" in ('sheet', 'web', 'excel', 'workshop'));