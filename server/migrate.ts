import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

export async function runMigrations() {
  // Resolved from cwd: /app in the container, repo root in dev.
  await migrate(db, { migrationsFolder: "migrations" });
  console.log("[db] migrations up to date");
}
