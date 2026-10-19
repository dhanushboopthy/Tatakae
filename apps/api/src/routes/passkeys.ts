import { Hono } from "hono";
import { passkeyLoginInput, passkeyPatch, passkeyReauthInput, passkeyRegisterInput, type PasskeySummary } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createSession, markAuthenticated } from "../lib/auth.service";
import {
  createChallengeStore,
  listPasskeys,
  loginOptions,
  registerPasskey,
  registrationOptions,
  removePasskey,
  renamePasskey,
  toSummary,
  verifyPasskeyLogin,
} from "../lib/passkeys.service";
import { recordSecurityEvent } from "../lib/security.service";
import { idParam, parseBody } from "../lib/validate";
import { auth, requireRecentAuth, setSessionCookie } from "../middleware/auth";

// v4 passkeys (WebAuthn), web only. Mounted before the global auth middleware:
//   POST /login/options  → PublicKeyCredentialRequestOptionsJSON            (public, rate-limited)
//   POST /login          body passkeyLoginInput → web session cookie        (public, rate-limited)
//   GET  /               → { passkeys: PasskeySummary[] }                   (auth)
//   POST /register/options → PublicKeyCredentialCreationOptionsJSON          (auth + recent password/passkey check)
//   POST /               body passkeyRegisterInput → PasskeySummary          (auth + recent check)
//   POST /reauth/options → PublicKeyCredentialRequestOptionsJSON            (auth, rate-limited)
//   POST /reauth         body passkeyReauthInput → { authAt }              (auth, rate-limited; step-up check)
//   PATCH /:id           body passkeyPatch → PasskeySummary                  (auth)
//   DELETE /:id          → { ok: true }                                     (auth)
// Each router instance has its own one-time challenge store.
export function passkeyRoutes() {
  const challenges = createChallengeStore();
  const r = new Hono<AppBindings>();

  r.post("/login/options", async (c) => c.json(await loginOptions(c.get("env"), challenges)));

  r.post("/login", async (c) => {
    const env = c.get("env");
    const db = c.get("db");
    const input = await parseBody(c, passkeyLoginInput);
    let key;
    try {
      key = await verifyPasskeyLogin(db, env, challenges, input.response);
    } catch (e) {
      recordSecurityEvent(db, { kind: "passkey_login_failed", client: "web", device: input.deviceName }, c);
      throw e;
    }
    const { token, session: s } = createSession(db, { client: "web", deviceName: input.deviceName, days: env.SESSION_DAYS });
    recordSecurityEvent(db, { kind: "passkey_login", client: "web", device: input.deviceName, detail: `passkey "${key.name}"` }, c);
    await setSessionCookie(c, token);
    return c.json({ email: env.OWNER_EMAIL, client: s.client, deviceName: s.deviceName, expiresAt: s.expiresAt });
  });

  r.use("/", auth);
  r.use("/register/*", auth);
  r.use("/reauth/*", auth);
  r.use("/:id", auth);

  r.get("/", (c) => c.json({ passkeys: listPasskeys(c.get("db")).map(toSummary) }));

  // Step-up check with a passkey instead of the password (web). Its challenges are kind "reauth".
  r.post("/reauth/options", async (c) => c.json(await loginOptions(c.get("env"), challenges, "reauth")));

  r.post("/reauth", async (c) => {
    const input = await parseBody(c, passkeyReauthInput);
    const db = c.get("db");
    let key;
    try {
      key = await verifyPasskeyLogin(db, c.get("env"), challenges, input.response, "reauth");
    } catch (e) {
      recordSecurityEvent(db, { kind: "reauth_failed", detail: "passkey" }, c);
      throw e;
    }
    const s = c.get("session");
    const authAt = s ? markAuthenticated(db, s.id) : new Date().toISOString();
    recordSecurityEvent(db, { kind: "reauth", detail: `with passkey "${key.name}"` }, c);
    return c.json({ authAt });
  });

  // A new passkey outlives any device sign-out, so a stolen session alone must not be able to add one.
  r.post("/register/options", async (c) => {
    requireRecentAuth(c);
    return c.json(await registrationOptions(c.get("db"), c.get("env"), challenges));
  });

  r.post("/", async (c) => {
    requireRecentAuth(c);
    const input = await parseBody(c, passkeyRegisterInput);
    const row = await registerPasskey(c.get("db"), c.get("env"), challenges, input);
    recordSecurityEvent(c.get("db"), { kind: "passkey_added", detail: row.name }, c);
    const body: PasskeySummary = toSummary(row);
    return c.json(body, 201);
  });

  r.patch("/:id", async (c) => {
    const input = await parseBody(c, passkeyPatch);
    return c.json(toSummary(renamePasskey(c.get("db"), idParam(c), input.name)));
  });

  r.delete("/:id", (c) => {
    const id = idParam(c);
    const name = listPasskeys(c.get("db")).find((p) => p.id === id)?.name ?? null;
    removePasskey(c.get("db"), id);
    recordSecurityEvent(c.get("db"), { kind: "passkey_removed", detail: name }, c);
    return c.json({ ok: true });
  });

  return r;
}
