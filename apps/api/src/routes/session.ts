import { Hono } from "hono";
import { verify } from "@node-rs/argon2";
import { loginInput, reauthInput, type LoginMobileResponse } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createSession, listSessions, markAuthenticated, revokeOtherSessions, revokeSession } from "../lib/auth.service";
import { HttpError, NotFound, Unauthorized } from "../lib/errors";
import { recordSecurityEvent } from "../lib/security.service";
import { idParam, parseBody } from "../lib/validate";
import { auth, clearSessionCookie, requireRecentAuth, setSessionCookie } from "../middleware/auth";

// Phase 0.
// POST /login  body loginInput { email, password, client, deviceName }
//   client "web"    → Set-Cookie tatakae_session, body { email, client, deviceName, expiresAt }
//   client "mobile" → 200 { token, expiresAt } (loginMobileResponse), no cookie
// POST /logout, GET /me, GET /devices, DELETE /devices/:id (revoke) — all need auth.
// POST /reauth { password } → { authAt }: step-up check on this session (403 wrong_password, never 401,
//   so a typo doesn't sign the device out). Revoking *another* device needs a recent check.
// POST /devices/sign-out-others → { signedOut }: keep only this session (recent check).
// The router is mounted before the global auth middleware, so it applies `auth` itself.
export const session = new Hono<AppBindings>();

session.use("/logout", auth);
session.use("/me", auth);
session.use("/reauth", auth);
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
  const deviceName = input.deviceName.trim();
  if (!emailOk || !passwordOk) {
    const detail = emailOk ? "wrong password" : "unknown email";
    recordSecurityEvent(c.get("db"), { kind: "login_failed", client: input.client, device: deviceName, detail }, c);
    throw new Unauthorized("Email or password is not right.", "invalid_credentials");
  }

  const { token, session: s } = createSession(c.get("db"), {
    client: input.client,
    deviceName,
    days: env.SESSION_DAYS,
  });
  recordSecurityEvent(c.get("db"), { kind: "login", client: input.client, device: deviceName, detail: "password" }, c);

  if (input.client === "mobile") {
    const body: LoginMobileResponse = { token, expiresAt: s.expiresAt };
    return c.json(body);
  }
  await setSessionCookie(c, token);
  return c.json({ email: env.OWNER_EMAIL, client: s.client, deviceName: s.deviceName, expiresAt: s.expiresAt });
});

session.post("/reauth", async (c) => {
  const env = c.get("env");
  const { password } = await parseBody(c, reauthInput);
  const ok = await passwordMatches(env.OWNER_PASSWORD_HASH, password);
  if (!ok) {
    recordSecurityEvent(c.get("db"), { kind: "reauth_failed", detail: "wrong password" }, c);
    throw new HttpError(403, "wrong_password", "That password isn't right.");
  }
  const s = c.get("session");
  const authAt = s ? markAuthenticated(c.get("db"), s.id) : new Date().toISOString();
  recordSecurityEvent(c.get("db"), { kind: "reauth", detail: "password" }, c);
  return c.json({ authAt });
});

session.post("/logout", async (c) => {
  const s = c.get("session");
  if (s) revokeSession(c.get("db"), s.id);
  clearSessionCookie(c);
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

// After a lost device or a password change: keep only this one. Needs a recent password check.
session.post("/devices/sign-out-others", (c) => {
  requireRecentAuth(c);
  const signedOut = revokeOtherSessions(c.get("db"), c.get("session")?.id ?? null);
  recordSecurityEvent(c.get("db"), { kind: "others_signed_out", detail: `${signedOut} device(s)` }, c);
  return c.json({ signedOut });
});

session.delete("/devices/:id", (c) => {
  const id = idParam(c);
  // Signing yourself out is always fine; signing out another device could lock the owner out.
  const own = c.get("session")?.id === id;
  if (!own) requireRecentAuth(c);
  const target = listSessions(c.get("db")).find((r) => r.id === id);
  if (!revokeSession(c.get("db"), id)) throw new NotFound("No such device.");
  if (!own) recordSecurityEvent(c.get("db"), { kind: "device_signed_out", detail: target ? `${target.deviceName} (${target.client})` : null }, c);
  if (c.get("session")?.id === id) {
    clearSessionCookie(c);
  }
  return c.json({ ok: true });
});
