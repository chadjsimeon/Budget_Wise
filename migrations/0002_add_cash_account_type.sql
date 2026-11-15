-- Postgres has no transactional way to undo an enum value, so keep this
-- re-runnable: IF NOT EXISTS makes it a no-op on a database that already has it.
ALTER TYPE "public"."account_type" ADD VALUE IF NOT EXISTS 'cash' BEFORE 'credit';
