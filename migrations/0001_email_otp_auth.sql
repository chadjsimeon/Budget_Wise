-- Migration: Replace username/password auth with email OTP
-- Idempotent — safe to run multiple times.

-- Step 1: Add email column if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

-- Step 2: Migrate existing usernames to email placeholder
UPDATE users SET email = username || '@migrated.local'
  WHERE email IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  );

-- Step 3: Default any remaining NULLs (safety net)
UPDATE users SET email = id || '@migrated.local' WHERE email IS NULL;

-- Step 4: Make email NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Step 5: Add unique constraint on email if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Step 6: Add created_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();

-- Step 7: Drop username unique constraint then column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    -- Try to drop unique constraint (name may vary)
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    ALTER TABLE users DROP COLUMN username;
  END IF;
END $$;

-- Step 8: Drop password column
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Step 9: Create otp_codes table
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
