-- Migration: Drop all app tables so drizzle-kit push can recreate them
-- from the current schema definition (email OTP auth, no username/password).
-- Idempotent — safe to run multiple times.

-- Drop all enums' dependent tables first, then enums
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS monthly_assignments CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS category_groups CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS budget_templates CASCADE;
DROP TABLE IF EXISTS tracking_accounts CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop enums so drizzle-kit push can recreate them cleanly
DROP TYPE IF EXISTS account_type CASCADE;
DROP TYPE IF EXISTS tracking_account_type CASCADE;
DROP TYPE IF EXISTS currency_placement CASCADE;
DROP TYPE IF EXISTS number_format CASCADE;
DROP TYPE IF EXISTS date_format CASCADE;
