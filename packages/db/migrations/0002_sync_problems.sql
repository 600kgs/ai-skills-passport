ALTER TABLE "sync_runs" ADD COLUMN "problems" jsonb;--> statement-breakpoint
-- sync used to log every 15 s poll; keep only the runs that did something
DELETE FROM "sync_runs" WHERE "new_records" = 0 AND "failed_records" = 0 AND "error" IS NULL;
