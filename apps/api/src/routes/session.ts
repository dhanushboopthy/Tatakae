import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { verify } from "@node-rs/argon2";
import { loginInput, type LoginMobileResponse } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createSession, listSessions, revokeSession } from "../lib/auth.service";
import { NotFound, Unauthorized } from "../lib/errors";
import { idParam, parseBody } from "../lib/validate";
import { auth, SESSION_COOKIE, sessionCookieOptions, setSessionCookie } from "../middleware/auth";

// Phase 0.
// POST /login  body loginInput { email, password, client, deviceName }
//   client "web"    → Set-Cookie tatakae_session, body { email, client, deviceName, expiresAt }
//   client "mobile" → 200 { token, expiresAt } (loginMobileResponse), no cookie
// POST /logout, GET /me, GET /devices, DELETE /devices/:id (revoke) — all need auth.
// The router is mounted before the global auth middleware, so it applies `auth` itself.
export const session = new Hono<AppBindings>();

session.use("/logout", auth);
session.use("/me", auth);
session.use("/devices", auth);
session.use("/devices/*", auth);

async function passwordMatches(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false; // malformed hash (e.g. dev placeholder) → just a failed login
  }
}

session.post("/login", async (c) => {
  const env = c.get("env");
  const input = await parseBody(c, loginInput);
  const emailOk = input.email.trim().toLowerCase() === env.OWNER_EMAIL.trim().toLowerCase();
  // Always run the hash check so a wrong email takes as long as a wrong password.
  const passwordOk = await passwordMatches(env.OWNER_PASSWORD_HASH, input.password);
  if (!emailOk || !passwordOk) throw new Unauthorized("Email or password is not right.", "invalid_credentials");

  const { token, session: s } = createSession(c.get("db"), {
    client: input.client,
    deviceName: input.deviceName.trim(),
    days: env.SESSION_DAYS,
  });

  if (input.client === "mobile") {
    const body: LoginMobileResponse = { token, expiresAt: s.expiresAt };
    return c.json(body);
  }
  await setSessionCookie(c, token);
  return c.json({ email: env.OWNER_EMAIL, client: s.client, deviceName: s.deviceName, expiresAt: s.expiresAt });
});

session.post("/logout", async (c) => {
  const s = c.get("session");
  if (s) revokeSession(c.get("db"), s.id);
  deleteCookie(c, SESSION_COOKIE, { path: sessionCookieOptions(c.get("env")).path, secure: c.get("env").NODE_ENV === "production" });
  return c.json({ ok: true });
});

session.get("/me", (c) => {
  const s = c.get("session");
  return c.json({
    email: c.get("email"),
    client: s?.client ?? null,
    deviceName: s?.deviceName ?? null,
    expiresAt: s?.expiresAt ?? null,
  });
});

session.get("/devices", (c) => {
  const current = c.get("session")?.id ?? null;
  const devices = listSessions(c.get("db")).map((r) => ({
    id: r.id,
    client: r.client,
    deviceName: r.deviceName,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    expiresAt: r.expiresAt,
    current: r.id === current,
  }));
  return c.json({ devices });
});

session.delete("/devices/:id", (c) => {
  const id = idParam(c);
  if (!revokeSession(c.get("db"), id)) throw new NotFound("No such device.");
  if (c.get("session")?.id === id) {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: c.get("env").NODE_ENV === "production" });
  }
  return c.json({ ok: true });
});
