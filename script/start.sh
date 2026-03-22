#!/bin/sh

echo "=== Migration Start ==="
echo "Checking migrations directory..."
ls -la migrations/ 2>&1

for f in migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "=== Applying $f ==="
  cat "$f"
  echo "=== Executing ==="
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    async function run() {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const sql = fs.readFileSync('$f', 'utf8');
        const result = await pool.query(sql);
        console.log('SUCCESS: Applied $f');
      } catch (e) {
        console.error('MIGRATION ERROR:', e.message);
        console.error('Full error:', JSON.stringify(e));
      } finally {
        await pool.end();
      }
    }
    run().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1); });
  "
  echo "=== Done with $f ==="
done

echo "=== Running drizzle-kit push ==="
npx drizzle-kit push --force --verbose 2>&1 || echo "=== drizzle-kit push failed ==="

echo "=== Starting server ==="
exec node dist/index.cjs
