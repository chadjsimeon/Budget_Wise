-- Migration: Replace username/password auth with email OTP
-- This runs BEFORE drizzle-kit push so that push sees the schema already matching.

-- Step 1: Add email column (nullable initially so existing rows don't break)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

-- Step 2: Migrate existing usernames to email (username -> username@migrated.local)
UPDATE users SET email = username || '@migrated.local' WHERE email IS NULL;

-- Step 3: Make email NOT NULL and add unique constraint
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Create unique index only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Step 4: Add created_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now() NOT NULL;

-- Step 5: Drop old columns (username unique constraint first, then columns)
DO $$
BEGIN
  -- Drop username unique constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_unique') THEN
    ALTER TABLE users DROP CONSTRAINT users_username_unique;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Step 6: Create otp_codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code varchar(6) NOT NULL,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts numeric NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now()
);

-- Create index on otp_codes
CREATE INDEX IF NOT EXISTS otp_codes_email_used_idx ON otp_codes (email, used);
