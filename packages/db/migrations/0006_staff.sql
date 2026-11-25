CREATE TYPE "public"."staff_role" AS ENUM('viewer', 'editor', 'admin', 'superadmin');--> statement-breakpoint
CREATE TABLE "staff" (
	"email" text PRIMARY KEY NOT NULL,
	"role" "staff_role" NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
