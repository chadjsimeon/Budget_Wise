#!/bin/sh
set -e

echo "Running SQL migrations..."
for f in migrations/*.sql; do
  echo "  Applying $f..."
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const sql = fs.readFileSync('$f', 'utf8');
    pool.query(sql)
      .then(() => { console.log('  Applied $f'); pool.end(); })
      .catch(e => { console.log('  Skipped $f:', e.message); pool.end(); });
  "
done

echo "Running drizzle-kit push..."
npx drizzle-kit push

echo "Starting server..."
node dist/index.cjs
