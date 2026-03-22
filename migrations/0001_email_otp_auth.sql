-- Migration: Replace username/password auth with email OTP
-- Wipes existing user data and rebuilds the users table cleanly.
-- Idempotent — safe to run multiple times.

-- Step 1: Drop all user-dependent data (cascades handle budget data)
TRUNCATE TABLE users CASCADE;

-- Step 2: Drop old columns if they exist
ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Step 3: Add new columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();

-- Step 4: Add unique constraint on email if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Step 5: Create otp_codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code varchar(6) NOT NULL,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts numeric NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_email_used_idx ON otp_codes (email, used);
