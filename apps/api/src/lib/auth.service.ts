import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { sessions } from "../../../../db/schema";
import type { SessionInfo } from "../env";
import type { Db } from "./db";

// Sessions (shared design, docs/plans/overnight.md → Auth): the raw token is 32 random bytes
// (base64url) and only ever leaves the server once; sessions.id stores sha256(token) as hex.

const DAY_MS = 86_400_000;
/** Sliding expiry: extend when fewer than this many days remain. */
export const SLIDE_WHEN_DAYS_LEFT = 30;
/** lastSeenAt is written at most this often per session. */
export const LAST_SEEN_THROTTLE_MS = 5 * 60_000;

export type SessionRow = typeof sessions.$inferSelect;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time string comparison (hashes first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function toSessionInfo(row: SessionRow): SessionInfo {
  return { id: row.id, client: row.client, deviceName: row.deviceName, expiresAt: row.expiresAt };
}

/** Create a session and return the raw token (never stored). Also drops expired sessions. */
export function createSession(
  db: Db,
  opts: { client: "web" | "mobile"; deviceName: string; days: number; now?: Date },
): { token: string; session: SessionInfo } {
  const now = opts.now ?? new Date();
  const at = now.toISOString();
  pruneExpired(db, now);
  const token = newSessionToken();
  const row: SessionRow = {
    id: hashToken(token),
    client: opts.client,
    deviceName: opts.deviceName,
    createdAt: at,
    expiresAt: new Date(now.getTime() + opts.days * DAY_MS).toISOString(),
    lastSeenAt: at,
    updatedAt: at,
    deletedAt: null,
  };
  db.insert(sessions).values(row).run();
  return { token, session: toSessionInfo(row) };
}

/** Valid (not expired, not revoked) session for a raw token, or null. */
export function lookupSession(db: Db, token: string, now: Date = new Date()): SessionRow | null {
  if (!token) return null;
  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, hashToken(token)), isNull(sessions.deletedAt), gt(sessions.expiresAt, now.toISOString())))
    .get();
  return row ?? null;
}

/**
 * Record activity on a session: lastSeenAt (throttled) and sliding expiry.
 * Returns the (possibly new) expiry and whether it was extended (web then re-sets the cookie).
 */
export function touchSession(
  db: Db,
  row: SessionRow,
  days: number,
  now: Date = new Date(),
): { expiresAt: string; extended: boolean } {
  const at = now.toISOString();
  const msLeft = Date.parse(row.expiresAt) - now.getTime();
  const extended = msLeft < SLIDE_WHEN_DAYS_LEFT * DAY_MS;
  const expiresAt = extended ? new Date(now.getTime() + days * DAY_MS).toISOString() : row.expiresAt;
  const lastSeen = row.lastSeenAt ? Date.parse(row.lastSeenAt) : 0;
  const stale = Number.isNaN(lastSeen) || now.getTime() - lastSeen >= LAST_SEEN_THROTTLE_MS;
  if (extended || stale) {
    db.update(sessions)
      .set({ lastSeenAt: at, expiresAt, updatedAt: at })
      .where(eq(sessions.id, row.id))
      .run();
  }
  return { expiresAt, extended };
}

/** Delete a session (logout / revoke). Returns false if it did not exist. */
export function revokeSession(db: Db, id: string): boolean {
  const res = db.delete(sessions).where(eq(sessions.id, id)).run();
  return res.changes > 0;
}

/** Active sessions, most recently seen first (Settings → Devices). */
export function listSessions(db: Db, now: Date = new Date()): SessionRow[] {
  const rows = db
    .select()
    .from(sessions)
    .where(and(isNull(sessions.deletedAt), gt(sessions.expiresAt, now.toISOString())))
    .all();
  return rows.sort((a, b) => (b.lastSeenAt ?? b.createdAt).localeCompare(a.lastSeenAt ?? a.createdAt));
}

export function pruneExpired(db: Db, now: Date = new Date()): void {
  db.delete(sessions).where(lte(sessions.expiresAt, now.toISOString())).run();
}
