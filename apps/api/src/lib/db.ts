import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRechargeRows, defaultSettingRows } from "@tatakae/core";
import * as schema from "../../../../db/schema";

type Sqlite = Database.Database;

/** Raw better-sqlite3 handle per drizzle instance (transactions and generic row SQL use it). */
const clients = new WeakMap<object, Sqlite>();

/** SQLite on the VM block volume. WAL mode so Litestream can stream it. */
export function openDb(path: string) {
  const inMemory = path === ":memory:" || path.startsWith("file::memory:");
  if (!inMemory) mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL"); // safe with WAL; wal_autocheckpoint stays default for Litestream
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  clients.set(db, sqlite);
  return db;
}
export type Db = ReturnType<typeof openDb>;

export function sqliteOf(db: Db): Sqlite {
  const sqlite = clients.get(db);
  if (!sqlite) throw new Error("db was not opened with openDb()");
  return sqlite;
}

/**
 * Run `fn` inside one SQLite transaction (nested calls become savepoints).
 * `fn` must be synchronous: better-sqlite3 commits when it returns.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  return sqliteOf(db).transaction(fn)();
}

export function closeDb(db: Db): void {
  const sqlite = clients.get(db);
  if (sqlite?.open) sqlite.close();
}

/**
 * Migrations folder: MIGRATIONS_DIR (set in the Docker image), else the repo's `db/migrations`,
 * found by walking up from this file (works from src/lib in dev and from dist/ when bundled).
 */
export function resolveMigrationsFolder(override?: string): string {
  if (override) return resolve(override);
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "db", "migrations");
    if (existsSync(resolve(candidate, "meta", "_journal.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("db/migrations not found; set MIGRATIONS_DIR");
}

/** Apply pending drizzle migrations, then insert default settings/recharge rows if missing. */
export function runMigrations(db: Db, migrationsFolder: string = resolveMigrationsFolder(process.env["MIGRATIONS_DIR"])): void {
  migrate(db, { migrationsFolder });
  seedDefaults(db);
}

/** INSERT OR IGNORE: never overwrites the owner's edits. Same values as db/seed.sql. */
export function seedDefaults(db: Db): void {
  transaction(db, () => {
    db.insert(schema.settings).values(defaultSettingRows()).onConflictDoNothing().run();
    db.insert(schema.rechargeItems).values(defaultRechargeRows()).onConflictDoNothing().run();
  });
}
