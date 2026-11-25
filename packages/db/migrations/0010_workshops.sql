CREATE TABLE "workshop_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_id" integer NOT NULL,
	"email" text NOT NULL,
	"student_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"program" text NOT NULL,
	"education_level" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"record_id" text,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"description" text NOT NULL,
	"description_en" text,
	"trainer" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text NOT NULL,
	"skill_id" text,
	"registration_url" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_kind" CHECK ("workshops"."kind" in ('workshop', 'hackathon')),
	CONSTRAINT "workshops_status" CHECK ("workshops"."status" in ('draft', 'published', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_skill_id_skills_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("skill_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_registrations_email_idx" ON "workshop_registrations" USING btree ("workshop_id","email");--> statement-breakpoint
CREATE INDEX "workshops_starts_idx" ON "workshops" USING btree ("starts_at");--> statement-breakpoint
ALTER TABLE "skill_awards" ADD CONSTRAINT "skill_awards_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;