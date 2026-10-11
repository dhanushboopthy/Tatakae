import { Cron } from "croner";
import type { Env } from "./env";
import type { Db } from "./lib/db";
import { runBackup } from "./cron/backup";
import { runMorningPush } from "./cron/morning";
import { runKeepWarm } from "./cron/keepWarm";

/** In-process scheduled jobs, all in Asia/Kolkata. */
export function startJobs(env: Env, db: Db): Cron[] {
  const tz = { timezone: env.TZ };
  return [
    new Cron("0 2 * * *", tz, () => runBackup(env, db)),        // 02:00 IST JSON export → Object Storage
    new Cron("30 6 * * *", tz, () => runMorningPush(env, db)),  // v4, optional: web push to laptops only (phone uses local notifications)
    new Cron("*/30 * * * *", tz, () => runKeepWarm(env, db)),   // see docs/08-operations.md (idle reclaim)
  ];
}
