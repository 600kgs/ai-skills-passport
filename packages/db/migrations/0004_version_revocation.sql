ALTER TABLE "passport_versions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "passport_versions" ADD COLUMN "revoke_reason" text;