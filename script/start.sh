#!/bin/sh

echo "Running SQL migrations..."
for f in migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "  Applying $f..."
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    async function run() {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const sql = fs.readFileSync('$f', 'utf8');
        await pool.query(sql);
        console.log('  Applied $f');
      } catch (e) {
        console.log('  Skipped $f:', e.message);
      } finally {
        await pool.end();
      }
    }
    run().then(() => process.exit(0)).catch(() => process.exit(1));
  "
done

echo "Running drizzle-kit push..."
npx drizzle-kit push --force || echo "drizzle-kit push failed, continuing anyway..."

echo "Starting server..."
exec node dist/index.cjs
