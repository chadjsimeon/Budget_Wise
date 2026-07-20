#!/bin/sh
set -e

# Production boot script (referenced by Dockerfile CMD).
#
# SAFETY: Schema changes reach production ONLY as reviewed migration files
# (shared/schema.ts -> `npm run db:generate` -> commit the SQL in migrations/).
# The server applies pending migrations itself at startup (server/migrate.ts)
# and refuses to boot if one fails. Never run `drizzle-kit push` against
# production — an unreviewed destructive diff is how deploys used to wipe data.

exec node dist/index.cjs
