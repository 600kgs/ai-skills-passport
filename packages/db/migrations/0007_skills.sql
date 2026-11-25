CREATE TABLE "skills" (
	"skill_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- seed: every skill already awarded, with the texts of its newest record
insert into "skills" ("skill_id", "name", "category", "description")
select distinct on ("skill_id") "skill_id", "skill_name", "category", "description"
from "skill_awards" order by "skill_id", "updated_at" desc
on conflict do nothing;
