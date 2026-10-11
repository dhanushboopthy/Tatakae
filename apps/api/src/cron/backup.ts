import type { Env } from "../env";
import type { Db } from "../lib/db";

/**
 * Second backup layer (Litestream is the first). Dump every table as JSON →
 * Object Storage backups/YYYY-MM-DD.json; keep newest 30. Log result to `job_runs`.
 */
export async function runBackup(env: Env, db: Db): Promise<void> {
  // TODO(v4)
}
