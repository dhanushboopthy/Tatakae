import type { Env } from "../env";
import type { Db } from "../lib/db";
import { listSubscriptions, morningMessage, pushConfigured, sendPush, webPushSender, type PushSender } from "../lib/push.service";
import { recordJob } from "../lib/system.service";

/**
 * OPTIONAL (v4): the 06:30 morning reminder as web push to laptops that opted in. The phone app
 * schedules its own LOCAL notifications. Skipped silently when VAPID keys or subscriptions are missing.
 */
export async function runMorningPush(env: Env, db: Db, sender: PushSender = webPushSender, now: Date = new Date()): Promise<void> {
  if (!pushConfigured(env)) return;
  const subs = listSubscriptions(db);
  if (subs.length === 0) return;
  try {
    const r = await sendPush(env, db, subs, morningMessage(db, now), sender);
    recordJob(db, "morning_push", now, r.failed === 0, `sent ${r.sent}${r.removed ? `, removed ${r.removed} expired` : ""}${r.failed ? `, ${r.failed} not delivered` : ""}`);
  } catch (e) {
    recordJob(db, "morning_push", now, false, e instanceof Error ? e.message : String(e));
  }
}
