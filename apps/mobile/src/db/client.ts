import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

/**
 * Local SQLite on the phone: the generic row store from the shared design (same shape as the web
 * IndexedDB store), so one sync client in @tatakae/core serves both.
 *
 *   rows(tbl, pk, data JSON, updated_at, deleted_at)  PK (tbl, pk) — every synced table
 *   outbox(id, json, created_at)                       pending writes, oldest first (rowid order)
 *   meta(key, value)                                   sync cursor, focus session, device flags
 *
 * Drizzle is not used on the phone: the row store has three fixed tables and rows travel as JSON.
 * Schema changes are tiny versioned migrations tracked with PRAGMA user_version.
 */

const DB_NAME = "tatakae.db";

/** Append only. Index i upgrades user_version i → i + 1. */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS rows (
    tbl TEXT NOT NULL,
    pk TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    PRIMARY KEY (tbl, pk)
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS rows_tbl_live ON rows (tbl, deleted_at);
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

function migrate(db: SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    if (sql === undefined) break;
    db.withTransactionSync(() => {
      db.execSync(sql);
      db.execSync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

let db: SQLiteDatabase | null = null;

/** The single app connection, opened and migrated on first use. */
export function getDb(): SQLiteDatabase {
  if (db) return db;
  const opened = openDatabaseSync(DB_NAME);
  opened.execSync("PRAGMA journal_mode = WAL;");
  migrate(opened);
  db = opened;
  return opened;
}

export const SCHEMA_VERSION = MIGRATIONS.length;
