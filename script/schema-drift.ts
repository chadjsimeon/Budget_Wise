import 'dotenv/config';
import pg from "pg";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

/**
 * Reports columns that shared/schema.ts expects but the database doesn't have.
 *
 * Why this exists: 0000_baseline.sql adopts push-created databases with
 * `CREATE TABLE IF NOT EXISTS`, which is all-or-nothing — if a table already
 * exists with an older shape, the statement is skipped and the missing columns
 * are never added. The migrator still records the baseline as applied, so the
 * server boots reporting "migrations up to date" and the drift only surfaces
 * later as a 500 ('column "email" does not exist').
 *
 * Read-only: this script never writes to the database.
 */

type Drift = {
  table: string;
  missingTable: boolean;
  missingColumns: { name: string; type: string; notNull: boolean }[];
};

function expectedTables(): { name: string; columns: ReturnType<typeof getTableConfig>["columns"] }[] {
  return Object.values(schema)
    .filter((value): value is PgTable => {
      // Drizzle tables carry a well-known symbol; relations/enums/zod schemas don't.
      return typeof value === "object" && value !== null && Symbol.for("drizzle:IsDrizzleTable") in value;
    })
    .map((table) => {
      const config = getTableConfig(table);
      return { name: config.name, columns: config.columns };
    });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );

    const actual = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name)!.add(row.column_name);
    }

    const drifts: Drift[] = [];
    for (const table of expectedTables()) {
      const actualColumns = actual.get(table.name);
      if (!actualColumns) {
        drifts.push({ table: table.name, missingTable: true, missingColumns: [] });
        continue;
      }
      const missingColumns = table.columns
        .filter((column) => !actualColumns.has(column.name))
        .map((column) => ({
          name: column.name,
          type: column.getSQLType(),
          notNull: column.notNull,
        }));
      if (missingColumns.length > 0) {
        drifts.push({ table: table.name, missingTable: false, missingColumns });
      }
    }

    if (drifts.length === 0) {
      console.log("[drift] no drift: every table and column in shared/schema.ts exists in the database");
      return;
    }

    console.log(`[drift] ${drifts.length} table(s) differ from shared/schema.ts:\n`);
    for (const drift of drifts) {
      if (drift.missingTable) {
        console.log(`  ${drift.table}: TABLE MISSING`);
        continue;
      }
      console.log(`  ${drift.table}: missing ${drift.missingColumns.length} column(s)`);
      for (const column of drift.missingColumns) {
        const nullability = column.notNull ? " NOT NULL" : "";
        console.log(`    - ${column.name} ${column.type}${nullability}`);
      }
    }
    console.log(
      "\nThese columns exist in shared/schema.ts but not in the database. Any query\n" +
        "touching them fails at runtime with 'column \"...\" does not exist'.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
