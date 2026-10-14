import { Hono } from "hono";
import { passkeyLoginInput, passkeyPatch, passkeyRegisterInput, type PasskeySummary } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createSession } from "../lib/auth.service";
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
import { idParam, parseBody } from "../lib/validate";
import { auth, setSessionCookie } from "../middleware/auth";

// v4 passkeys (WebAuthn), web only. Mounted before the global auth middleware:
//   POST /login/options  → PublicKeyCredentialRequestOptionsJSON            (public, rate-limited)
//   POST /login          body passkeyLoginInput → web session cookie        (public, rate-limited)
//   GET  /               → { passkeys: PasskeySummary[] }                   (auth)
//   POST /register/options → PublicKeyCredentialCreationOptionsJSON          (auth)
//   POST /               body passkeyRegisterInput → PasskeySummary          (auth)
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
    await verifyPasskeyLogin(db, env, challenges, input.response);
    const { token, session: s } = createSession(db, { client: "web", deviceName: input.deviceName, days: env.SESSION_DAYS });
    await setSessionCookie(c, token);
    return c.json({ email: env.OWNER_EMAIL, client: s.client, deviceName: s.deviceName, expiresAt: s.expiresAt });
  });

  r.use("/", auth);
  r.use("/register/*", auth);
  r.use("/:id", auth);

  r.get("/", (c) => c.json({ passkeys: listPasskeys(c.get("db")).map(toSummary) }));

  r.post("/register/options", async (c) => c.json(await registrationOptions(c.get("db"), c.get("env"), challenges)));

  r.post("/", async (c) => {
    const input = await parseBody(c, passkeyRegisterInput);
    const row = await registerPasskey(c.get("db"), c.get("env"), challenges, input);
    const body: PasskeySummary = toSummary(row);
    return c.json(body, 201);
  });

  r.patch("/:id", async (c) => {
    const input = await parseBody(c, passkeyPatch);
    return c.json(toSummary(renamePasskey(c.get("db"), idParam(c), input.name)));
  });

  r.delete("/:id", (c) => {
    removePasskey(c.get("db"), idParam(c));
    return c.json({ ok: true });
  });

  return r;
}
