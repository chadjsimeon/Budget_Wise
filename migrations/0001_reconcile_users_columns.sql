-- Reconcile `users` on databases the baseline could not adopt.
--
-- 0000_baseline.sql uses `CREATE TABLE IF NOT EXISTS "users"` so it can adopt
-- databases originally created with `drizzle-kit push`. That is all-or-nothing:
-- on a database whose `users` table predates the email-auth rewrite (it had
-- id/username/password), the statement is skipped entirely and the newer
-- columns are never added. The migrator still records the baseline as applied,
-- so the server boots printing "migrations up to date" while every query that
-- touches `email` fails with 'column "email" does not exist' — a 500 on both
-- /api/auth/register and /api/auth/login.
--
-- This migration is additive and non-destructive: it adds missing columns,
-- backfills `email` from the legacy `username` when one is present, and leaves
-- every existing row in place. Nothing here drops a column or deletes a row.
-- It must never fail, because a failed migration stops the server from booting.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

-- Backfill `email` from the legacy `username` column when it exists. Guarded by
-- dynamic SQL so `username` is never parsed on databases that don't have it.
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
	) THEN
		EXECUTE 'UPDATE "users" SET "email" = "username" WHERE "email" IS NULL AND "username" IS NOT NULL';
	END IF;
END $$;--> statement-breakpoint

-- Legacy columns the current schema no longer writes would block every INSERT
-- while they are still NOT NULL. Relax them rather than dropping the data.
DO $$
DECLARE
	legacy_column text;
BEGIN
	FOREACH legacy_column IN ARRAY ARRAY['username'] LOOP
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			 WHERE table_schema = 'public' AND table_name = 'users'
			   AND column_name = legacy_column AND is_nullable = 'NO'
		) THEN
			EXECUTE format('ALTER TABLE "users" ALTER COLUMN %I DROP NOT NULL', legacy_column);
		END IF;
	END LOOP;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
EXCEPTION
	WHEN duplicate_object THEN NULL;
	WHEN duplicate_table THEN NULL;
	WHEN unique_violation THEN
		RAISE WARNING 'users.email holds duplicates; unique constraint not added';
END $$;--> statement-breakpoint

-- Only enforce NOT NULL once every row actually has an email. If some legacy
-- row could not be backfilled, leave the column nullable rather than failing
-- the migration and taking the server down with it.
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM "users" WHERE "email" IS NULL) THEN
		ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
	ELSE
		RAISE WARNING 'users.email has NULL rows; leaving column nullable';
	END IF;
END $$;
