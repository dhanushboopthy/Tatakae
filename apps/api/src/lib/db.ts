import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blocksToText, defaultRechargeRows, defaultSettingRows } from "@tatakae/core";
import * as schema from "../../../../db/schema";

type Sqlite = Database.Database;

/**
 * Two drivers, one synchronous better-sqlite3-style API (so services and drizzle don't care):
 *  - better-sqlite3 on a local file: development, tests, a VM with a durable disk.
 *  - `libsql` as a Turso embedded replica (Zoho Catalyst AppSail, whose disk is wiped on restart):
 *    reads hit a local copy, writes and every statement inside a transaction go to the Turso primary,
 *    and read-your-writes keeps the local copy current. `libsql` is loaded only on this path, so
 *    development and tests never need its native binary.
 */
export interface ReplicaOptions {
  /** libsql://<db>-<org>.turso.io */
  syncUrl: string;
  authToken?: string;
  /** Also pull from the primary every N seconds (writes from this process are always visible). */
  syncPeriodSec?: number;
}

interface Conn {
  sqlite: Sqlite;
  /** libsql has no nested transactions: inner `transaction()` calls use explicit SAVEPOINTs. */
  manualSavepoints: boolean;
}

/** Raw handle per drizzle instance (transactions and generic row SQL use it). */
const clients = new WeakMap<object, Conn>();

interface LibsqlDatabase extends Sqlite {
  sync(): { frames_synced: number };
}

function openReplica(path: string, opts: ReplicaOptions): LibsqlDatabase {
  const require = createRequire(import.meta.url);
  const Libsql = require("libsql") as new (path: string, options: Record<string, unknown>) => LibsqlDatabase;
  return new Libsql(path, {
    syncUrl: opts.syncUrl,
    authToken: opts.authToken,
    readYourWrites: true,
    ...(opts.syncPeriodSec ? { syncPeriod: opts.syncPeriodSec } : {}),
  });
}

/**
 * Open the database. Without `replica`: SQLite file (WAL, so Litestream can stream it on a VM).
 * With `replica`: a Turso embedded replica at `path` (scratch space), synced before returning.
 * `manualSavepoints` forces the libsql transaction path on better-sqlite3 (tests).
 */
export function openDb(path: string, opts: { replica?: ReplicaOptions; manualSavepoints?: boolean } = {}) {
  const inMemory = path === ":memory:" || path.startsWith("file::memory:");
  if (!inMemory) mkdirSync(dirname(resolve(path)), { recursive: true });
  let conn: Conn;
  if (opts.replica) {
    const sqlite = openReplica(path, opts.replica);
    sqlite.sync(); // start from the primary's current state, not whatever a previous container left
    conn = { sqlite, manualSavepoints: true };
  } else {
    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL"); // safe with WAL; wal_autocheckpoint stays default for Litestream
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    conn = { sqlite, manualSavepoints: opts.manualSavepoints ?? false };
  }
  const db = drizzle(conn.sqlite, { schema });
  clients.set(db, conn);
  return db;
}
export type Db = ReturnType<typeof openDb>;

function connOf(db: Db): Conn {
  const conn = clients.get(db);
  if (!conn) throw new Error("db was not opened with openDb()");
  return conn;
}

export function sqliteOf(db: Db): Sqlite {
  return connOf(db).sqlite;
}

let savepointSeq = 0;

/**
 * Run `fn` inside one SQLite transaction; nested calls become savepoints, so a failing inner call
 * rolls back alone when the caller catches it (sync applies each item that way).
 * `fn` must be synchronous: the transaction commits when it returns.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  const { sqlite, manualSavepoints } = connOf(db);
  if (!manualSavepoints || !sqlite.inTransaction) return sqlite.transaction(fn)();
  const name = `tk_sp_${++savepointSeq}`;
  sqlite.exec(`SAVEPOINT ${name}`);
  try {
    const result = fn();
    sqlite.exec(`RELEASE ${name}`);
    return result;
  } catch (e) {
    sqlite.exec(`ROLLBACK TO ${name}`);
    sqlite.exec(`RELEASE ${name}`);
    throw e;
  }
}

export function closeDb(db: Db): void {
  const conn = clients.get(db);
  if (!conn) return;
  try {
    conn.sqlite.close();
  } catch {
    // already closed
  }
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
  backfillNoteText(db);
}

/** Notes saved before migration 0003 have no body_text yet; fill it so search sees plain text. */
function backfillNoteText(db: Db): void {
  const sqlite = sqliteOf(db);
  const rows = sqlite.prepare(`SELECT id, body_json FROM notes WHERE body_text IS NULL AND body_json IS NOT NULL`).all() as {
    id: string;
    body_json: string;
  }[];
  if (rows.length === 0) return;
  const update = sqlite.prepare(`UPDATE notes SET body_text = ? WHERE id = ?`);
  transaction(db, () => {
    for (const r of rows) {
      let blocks: unknown = null;
      try {
        blocks = JSON.parse(r.body_json);
      } catch {
        // not JSON: index nothing rather than the raw text
      }
      update.run(blocksToText(blocks), r.id);
    }
  });
}

/** INSERT OR IGNORE: never overwrites the owner's edits. Same values as db/seed.sql. */
export function seedDefaults(db: Db): void {
  transaction(db, () => {
    db.insert(schema.settings).values(defaultSettingRows()).onConflictDoNothing().run();
    db.insert(schema.rechargeItems).values(defaultRechargeRows()).onConflictDoNothing().run();
  });
}
