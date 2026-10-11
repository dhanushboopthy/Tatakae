import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

/**
 * Local SQLite on the phone: cache of v1 tables (days, missions, habits, habit_logs, inbox, settings)
 * + outbox + sync meta. Reuse table definitions from db/schema.ts where possible.
 */
const sqlite = openDatabaseSync("tatakae.db");
export const localDb = drizzle(sqlite);
// TODO(v1): migrations from src/db/migrations (drizzle-kit, expo driver)
