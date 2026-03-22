-- Migration: Replace username/password auth with email OTP
-- Wipes existing user data and rebuilds the users table cleanly.
-- Idempotent — safe to run multiple times.

-- Drop tables that depend on users (cascade won't help with drizzle-kit's view of things)
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS monthly_assignments CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS category_groups CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS budget_templates CASCADE;
DROP TABLE IF EXISTS tracking_accounts CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table with new schema
CREATE TABLE users (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- Create otp_codes table
CREATE TABLE otp_codes (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code varchar(6) NOT NULL,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts numeric NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX otp_codes_email_used_idx ON otp_codes (email, used);
