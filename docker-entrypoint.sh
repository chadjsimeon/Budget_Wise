#!/bin/sh
set -e

echo "Pushing database schema..."
npx drizzle-kit push --force
echo "Schema pushed successfully."

echo "Starting application..."
exec node dist/index.cjs
