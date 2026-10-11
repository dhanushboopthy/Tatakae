import type { Env } from "../env";
import type { Db } from "../lib/db";

/** OPTIONAL (v4): web push to laptop browsers only. The phone app schedules its own LOCAL notifications. */
export async function runMorningPush(env: Env, db: Db): Promise<void> {
  // TODO(v4)
}
