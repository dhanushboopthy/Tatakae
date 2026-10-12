import { eq } from "drizzle-orm";
import webpush from "web-push";
import { todayIST, type PushSubscribeInput } from "@tatakae/core";
import { pushSubscriptions } from "../../../../db/schema";
import type { Env } from "../env";
import type { Db } from "./db";
import { allRows } from "./rows.service";

// Laptop web push (v4, optional). The phone uses local notifications, so this only carries the
// morning reminder to laptops that opted in (one per day). Subscriptions are never synced or exported.

export type PushRow = typeof pushSubscriptions.$inferSelect;
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}
/** Swappable in tests. Resolves on delivery; rejects with a `statusCode` on push-service errors. */
export type PushSender = (sub: PushRow, payload: string, env: Env) => Promise<unknown>;

export function pushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export const webPushSender: PushSender = (sub, payload, env) =>
  webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    TTL: 4 * 3600, // a morning reminder is useless by lunch
    urgency: "normal",
    vapidDetails: { subject: env.VAPID_SUBJECT ?? "", publicKey: env.VAPID_PUBLIC_KEY ?? "", privateKey: env.VAPID_PRIVATE_KEY ?? "" },
  });

export function saveSubscription(db: Db, input: PushSubscribeInput): PushRow {
  const at = new Date().toISOString();
  const row: PushRow = { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, device: input.device, updatedAt: at, deletedAt: null };
  db.insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: row.p256dh, auth: row.auth, device: row.device, updatedAt: at, deletedAt: null } })
    .run();
  return row;
}

export function removeSubscription(db: Db, endpoint: string): boolean {
  return db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run().changes > 0;
}

export function listSubscriptions(db: Db): PushRow[] {
  return db.select().from(pushSubscriptions).all().filter((s) => s.deletedAt == null);
}

const statusOf = (e: unknown): number | null =>
  typeof e === "object" && e !== null && typeof (e as { statusCode?: unknown }).statusCode === "number" ? (e as { statusCode: number }).statusCode : null;

/** Send to each subscription; ones the push service reports gone (404/410) are deleted. */
export async function sendPush(
  env: Env,
  db: Db,
  subs: readonly PushRow[],
  msg: PushMessage,
  sender: PushSender = webPushSender,
): Promise<{ sent: number; removed: number; failed: number }> {
  const payload = JSON.stringify(msg);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await sender(sub, payload, env);
      sent++;
    } catch (e) {
      const status = statusOf(e);
      if (status === 404 || status === 410) {
        removeSubscription(db, sub.endpoint);
        removed++;
      } else {
        failed++;
      }
    }
  }
  return { sent, removed, failed };
}

/** The 06:30 message: today's P1 and its Minimum, or a calm nudge to pick one thing. */
export function morningMessage(db: Db, now: Date = new Date()): PushMessage {
  const today = todayIST(now);
  const p1 = allRows(db, "missions", { includeDeleted: false }).find((m) => m.dayDate === today && m.slot === "P1");
  if (!p1) return { title: "Good morning", body: "No plan for today yet. Pick one thing and start small.", url: "/today", tag: "morning" };
  const body = p1.minimum ? `P1: ${p1.title}. Minimum: ${p1.minimum}` : `P1: ${p1.title}`;
  return { title: "Good morning", body: body.slice(0, 180), url: "/today", tag: "morning" };
}
