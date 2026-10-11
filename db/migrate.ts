// Local helper: apply migrations (and seed defaults) to DATABASE_PATH. In production the API does
// this on boot. Usage: `pnpm db:migrate` (DATABASE_PATH defaults to ./data/tatakae.db).
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

type SqliteClient = Parameters<typeof drizzle>[0];
type SqliteCtor = new (path: string) => SqliteClient;

const here = dirname(fileURLToPath(import.meta.url));
// better-sqlite3 is a dependency of apps/api; with pnpm's isolated linker it is not resolvable
// from db/, so load it relative to the api package.
const requireFromApi = createRequire(resolve(here, "../apps/api/package.json"));
const Database = requireFromApi("better-sqlite3") as SqliteCtor;

// Relative paths are taken from the repo root (same as drizzle.config.ts), not from the cwd.
const dbPath = resolve(here, "..", process.env.DATABASE_PATH ?? "data/tatakae.db");
const migrationsFolder = resolve(here, "migrations");

mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

migrate(drizzle(sqlite), { migrationsFolder });
sqlite.exec(readFileSync(resolve(here, "seed.sql"), "utf8")); // INSERT OR IGNORE: safe to re-run
sqlite.close();

console.log(`migrated ${dbPath}`);
