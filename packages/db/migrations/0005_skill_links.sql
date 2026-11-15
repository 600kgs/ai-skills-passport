CREATE TABLE "skill_links" (
	"code" text PRIMARY KEY NOT NULL,
	"passport_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skill_links" ADD CONSTRAINT "skill_links_passport_id_passports_passport_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."passports"("passport_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_links_skill_idx" ON "skill_links" USING btree ("passport_id","skill_id");