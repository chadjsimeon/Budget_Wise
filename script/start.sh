#!/bin/sh
set -e

# Production boot script (referenced by Dockerfile CMD).
#
# SAFETY: This must NEVER destroy existing data. Do not add a loop that executes
# raw migrations/*.sql at boot — that is how every deploy previously wiped the
# database (a hand-written "clean slate" DROP TABLE migration ran on every start).
#
# Schema is kept in sync with `drizzle-kit push`, which only ADDS/ALTERS where the
# live DB diverges from shared/schema.ts. It will not drop a table/column that is
# still defined in the schema. Keep schema changes ADDITIVE; removing a column or
# table from schema.ts can cause push --force to drop it, so such changes need an
# explicit, reviewed migration instead.

echo "=== Syncing database schema (additive) ==="
npx drizzle-kit push --force --verbose 2>&1 || echo "=== drizzle-kit push failed ==="

echo "=== Starting server ==="
exec node dist/index.cjs
