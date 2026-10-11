import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env";

/**
 * Single-user auth. Accepts, in order:
 *  1. Web: `tatakae_session` cookie (HttpOnly, Secure, SameSite=Lax, signed with SESSION_SECRET)
 *  2. Phone app: `Authorization: Bearer <session token>` (sessions.client = "mobile")
 *  3. Scripts: `Authorization: Bearer <API_TOKEN>` (notion import, backups) — separate from sessions
 * Session tokens are stored hashed. Sliding expiry: refresh when < 30 days left.
 * DEV_BYPASS_AUTH=1 only when NODE_ENV=development.
 * CORS: not needed — web is same-origin behind Caddy, the native app has no browser origin.
 * TODO(v4): passkeys (WebAuthn) as primary on web.
 */
export const auth: MiddlewareHandler<AppBindings> = async (c, next) => {
  // TODO(phase0)
  await next();
};
