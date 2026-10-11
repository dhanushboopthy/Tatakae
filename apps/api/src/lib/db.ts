import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../../../db/schema";

/** SQLite on the VM block volume. WAL mode so Litestream can stream it. */
export function openDb(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  // TODO(phase0): synchronous = NORMAL; wal_autocheckpoint left default for Litestream
  return drizzle(sqlite, { schema });
}
export type Db = ReturnType<typeof openDb>;

export function runMigrations(db: Db): void {
  // TODO(phase0): migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? "../../db/migrations" })
}
