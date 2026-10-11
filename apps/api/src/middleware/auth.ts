import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppBindings, Env } from "../env";
import { lookupSession, safeEqual, toSessionInfo, touchSession, type SessionRow } from "../lib/auth.service";

export const SESSION_COOKIE = "tatakae_session";

/** Cookie options from the shared design: HttpOnly, Secure in production, Lax, path /, SESSION_DAYS max-age. */
export function sessionCookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: env.SESSION_DAYS * 86_400,
  };
}

export async function setSessionCookie(c: Context<AppBindings>, token: string): Promise<void> {
  const env = c.get("env");
  await setSignedCookie(c, SESSION_COOKIE, token, env.SESSION_SECRET, sessionCookieOptions(env));
}

function bearerToken(c: Context<AppBindings>): string | null {
  const header = c.req.header("authorization");
  const m = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return m?.[1] ?? null;
}

async function useSession(c: Context<AppBindings>, row: SessionRow, viaCookie: boolean, token: string): Promise<void> {
  const env = c.get("env");
  const { expiresAt, extended } = touchSession(c.get("db"), row, env.SESSION_DAYS);
  if (extended && viaCookie) await setSessionCookie(c, token);
  c.set("session", { ...toSessionInfo(row), expiresAt });
  c.set("email", env.OWNER_EMAIL);
}

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
  const env = c.get("env");
  const db = c.get("db");

  if (env.NODE_ENV === "development" && env.DEV_BYPASS_AUTH === "1") {
    c.set("session", null);
    c.set("email", env.OWNER_EMAIL);
    return next();
  }

  const cookie = await getSignedCookie(c, env.SESSION_SECRET, SESSION_COOKIE);
  if (typeof cookie === "string" && cookie) {
    const row = lookupSession(db, cookie);
    if (row) {
      await useSession(c, row, true, cookie);
      return next();
    }
  }

  const bearer = bearerToken(c);
  if (bearer) {
    const row = lookupSession(db, bearer);
    if (row) {
      await useSession(c, row, false, bearer);
      return next();
    }
    if (env.API_TOKEN && safeEqual(bearer, env.API_TOKEN)) {
      c.set("session", null);
      c.set("email", env.OWNER_EMAIL);
      return next();
    }
  }

  return c.json({ error: "unauthorized", message: "Sign in again." }, 401);
};
