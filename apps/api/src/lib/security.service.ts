import type { Context } from "hono";
import { desc, lt, sql } from "drizzle-orm";
import type { SecurityEvent, SecurityEventKind } from "@tatakae/core";
import { securityEvents } from "../../../../db/schema";
import type { AppBindings } from "../env";
import { clientIp } from "../middleware/rateLimit";
import type { Db } from "./db";
import { newId } from "./ids";

// Security event log (S9): sign-ins, failed attempts, step-up checks and security changes, so the
// owner can spot a sign-in that wasn't theirs (Settings → Devices). Server-only; newest KEEP rows.

export const KEEP_SECURITY_EVENTS = 500;

type EventRow = typeof securityEvents.$inferSelect;

export interface EventInput {
  kind: SecurityEventKind;
  client?: "web" | "mobile" | null;
  device?: string | null;
  detail?: string | null;
}

/** Record one event, with the caller's IP and browser from the request when there is one. */
export function recordSecurityEvent(db: Db, input: EventInput, c?: Context<AppBindings>, now: Date = new Date()): void {
  const at = now.toISOString();
  const session = c?.get("session") ?? null;
  const ip = c ? clientIp(c) : null;
  db.insert(securityEvents)
    .values({
      id: newId(),
      at,
      kind: input.kind,
      client: input.client ?? session?.client ?? null,
      device: (input.device ?? session?.deviceName ?? null)?.slice(0, 80) ?? null,
      ip: ip && ip !== "unknown" ? ip.slice(0, 64) : null,
      userAgent: c?.req.header("user-agent")?.slice(0, 200) ?? null,
      detail: input.detail?.slice(0, 200) ?? null,
      updatedAt: at,
      deletedAt: null,
    })
    .run();
  prune(db);
}

function prune(db: Db): void {
  const cutoff = db
    .select({ at: securityEvents.at })
    .from(securityEvents)
    .orderBy(desc(securityEvents.at))
    .limit(1)
    .offset(KEEP_SECURITY_EVENTS - 1)
    .get();
  if (cutoff) db.delete(securityEvents).where(lt(securityEvents.at, cutoff.at)).run();
}

const decode = (r: EventRow): SecurityEvent => ({
  id: r.id,
  at: r.at,
  kind: r.kind as SecurityEventKind,
  client: r.client === "web" || r.client === "mobile" ? r.client : null,
  device: r.device,
  ip: r.ip,
  userAgent: r.userAgent,
  detail: r.detail,
});

/** Newest first. */
export function listSecurityEvents(db: Db, limit = 100): SecurityEvent[] {
  // rowid breaks ties inside one millisecond (ULIDs are random within it).
  return db.select().from(securityEvents).orderBy(desc(securityEvents.at), desc(sql`rowid`)).limit(limit).all().map(decode);
}
