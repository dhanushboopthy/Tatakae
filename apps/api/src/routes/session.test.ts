import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessions } from "../../../../db/schema";
import { hashToken } from "../lib/auth.service";
import { API_TOKEN, call, login, OWNER, setup } from "../test/helpers";

const DAY_MS = 86_400_000;

describe("session routes", () => {
  it("mobile login returns a token (no cookie) that works as a bearer", async () => {
    const { app, db } = await setup();
    const res = await call(app, "POST", "/session/login", { email: OWNER.email, password: OWNER.password, client: "mobile", deviceName: "phone" }, {});
    expect(res.status).toBe(200);
    expect(typeof res.body["token"]).toBe("string");
    expect(typeof res.body["expiresAt"]).toBe("string");
    expect(res.res.headers.get("set-cookie")).toBeNull();

    // Only the hash is stored.
    const token = String(res.body["token"]);
    const row = db.select().from(sessions).where(eq(sessions.id, hashToken(token))).get();
    expect(row?.client).toBe("mobile");
    expect(db.select().from(sessions).where(eq(sessions.id, token)).get()).toBeUndefined();

    const me = await call(app, "GET", "/session/me", undefined, { authorization: `Bearer ${token}` });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: OWNER.email, client: "mobile", deviceName: "phone" });
  });

  it("web login sets an HttpOnly SameSite=Lax cookie that authenticates /me", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/session/login", { email: OWNER.email, password: OWNER.password, client: "web", deviceName: "laptop-1" }, {});
    expect(res.status).toBe(200);
    expect(res.body["token"]).toBeUndefined();
    const cookie = res.res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^tatakae_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);

    const me = await call(app, "GET", "/session/me", undefined, { cookie: cookie.split(";")[0] ?? "" });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: OWNER.email, client: "web", deviceName: "laptop-1" });
  });

  it("email is case-insensitive", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/session/login", { email: OWNER.email.toUpperCase(), password: OWNER.password, client: "mobile", deviceName: "phone" }, {});
    expect(res.status).toBe(200);
  });

  it("wrong password and wrong email give the same generic 401", async () => {
    const { app } = await setup();
    const badPass = await call(app, "POST", "/session/login", { email: OWNER.email, password: "wrong password!", client: "web", deviceName: "x" }, {});
    const badEmail = await call(app, "POST", "/session/login", { email: "someone@example.com", password: OWNER.password, client: "web", deviceName: "x" }, {});
    expect(badPass.status).toBe(401);
    expect(badEmail.status).toBe(401);
    expect(badPass.body).toEqual(badEmail.body);
    expect(badPass.res.headers.get("set-cookie")).toBeNull();
  });

  it("invalid login body is a 400 with issues", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/session/login", { email: "nope", password: "x", client: "tablet" }, {});
    expect(res.status).toBe(400);
    expect(res.body["error"]).toBe("invalid_input");
    expect(Array.isArray(res.body["detail"])).toBe(true);
  });

  it("/me, /logout and /devices need auth; /health does not", async () => {
    const { app } = await setup();
    expect((await call(app, "GET", "/session/me", undefined, {})).status).toBe(401);
    expect((await call(app, "POST", "/session/logout", undefined, {})).status).toBe(401);
    expect((await call(app, "GET", "/session/devices", undefined, {})).status).toBe(401);
    expect((await call(app, "GET", "/days/2026-10-20", undefined, {})).status).toBe(401);
    expect((await call(app, "GET", "/health", undefined, {})).status).toBe(200);
  });

  it("logout deletes the session", async () => {
    const { app } = await setup();
    const auth = await login(app, "mobile");
    const out = await call(app, "POST", "/session/logout", undefined, auth);
    expect(out.status).toBe(200);
    expect((await call(app, "GET", "/session/me", undefined, auth)).status).toBe(401);
  });

  it("web logout clears the cookie", async () => {
    const { app } = await setup();
    const auth = await login(app, "web");
    const out = await call(app, "POST", "/session/logout", undefined, auth);
    expect(out.status).toBe(200);
    expect(out.res.headers.get("set-cookie") ?? "").toMatch(/tatakae_session=;.*Max-Age=0/i);
    expect((await call(app, "GET", "/session/me", undefined, auth)).status).toBe(401);
  });

  it("lists devices with a current flag and revokes another device", async () => {
    const { app } = await setup();
    const phone = await login(app, "mobile", "phone");
    const laptop = await login(app, "web", "laptop-1");

    const list = await call(app, "GET", "/session/devices", undefined, laptop);
    expect(list.status).toBe(200);
    const devices = list.body["devices"] as { id: string; deviceName: string; current: boolean }[];
    expect(devices).toHaveLength(2);
    expect(devices.find((d) => d.deviceName === "laptop-1")?.current).toBe(true);
    const phoneDevice = devices.find((d) => d.deviceName === "phone");
    expect(phoneDevice?.current).toBe(false);

    const del = await call(app, "DELETE", `/session/devices/${phoneDevice?.id ?? ""}`, undefined, laptop);
    expect(del.status).toBe(200);
    expect((await call(app, "GET", "/session/me", undefined, phone)).status).toBe(401);
    expect((await call(app, "GET", "/session/me", undefined, laptop)).status).toBe(200);
    expect((await call(app, "DELETE", `/session/devices/${phoneDevice?.id ?? ""}`, undefined, laptop)).status).toBe(404);
  });

  it("expired sessions are rejected", async () => {
    const { app, db } = await setup();
    const auth = await login(app, "mobile");
    const token = (auth["authorization"] ?? "").replace("Bearer ", "");
    db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(sessions.id, hashToken(token))).run();
    expect((await call(app, "GET", "/session/me", undefined, auth)).status).toBe(401);
  });

  it("slides the expiry when fewer than 30 days remain", async () => {
    const { app, db, env } = await setup();
    const auth = await login(app, "mobile");
    const id = hashToken((auth["authorization"] ?? "").replace("Bearer ", ""));
    db.update(sessions).set({ expiresAt: new Date(Date.now() + 10 * DAY_MS).toISOString() }).where(eq(sessions.id, id)).run();

    const me = await call(app, "GET", "/session/me", undefined, auth);
    expect(me.status).toBe(200);
    const expiresAt = Date.parse(String(me.body["expiresAt"]));
    expect(expiresAt).toBeGreaterThan(Date.now() + (env.SESSION_DAYS - 1) * DAY_MS);
    const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
    expect(Date.parse(row?.expiresAt ?? "")).toBe(expiresAt);
  });

  it("re-sets the web cookie when the expiry slides", async () => {
    const { app, db } = await setup();
    const auth = await login(app, "web");
    db.update(sessions).set({ expiresAt: new Date(Date.now() + 5 * DAY_MS).toISOString() }).run();
    const me = await call(app, "GET", "/session/me", undefined, auth);
    expect(me.status).toBe(200);
    expect(me.res.headers.get("set-cookie") ?? "").toMatch(/^tatakae_session=/);
  });

  it("API_TOKEN bearer works for scripts; a wrong token does not", async () => {
    const { app } = await setup();
    const ok = await call(app, "GET", "/session/me", undefined, { authorization: `Bearer ${API_TOKEN}` });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ email: OWNER.email, client: null });
    const bad = await call(app, "GET", "/session/me", undefined, { authorization: `Bearer ${API_TOKEN}nope` });
    expect(bad.status).toBe(401);
  });

  it("a tampered cookie is rejected", async () => {
    const { app } = await setup();
    const auth = await login(app, "web");
    const cookie = auth["cookie"] ?? "";
    const tampered = cookie.replace(/=(.)/, (_m, ch: string) => `=${ch === "a" ? "b" : "a"}`);
    expect((await call(app, "GET", "/session/me", undefined, { cookie: tampered })).status).toBe(401);
  });

  it("DEV_BYPASS_AUTH is ignored outside development", async () => {
    const { app } = await setup({ DEV_BYPASS_AUTH: "1" });
    expect((await call(app, "GET", "/session/me", undefined, {})).status).toBe(401);
  });

  it("DEV_BYPASS_AUTH works in development", async () => {
    const { app } = await setup({ NODE_ENV: "development", DEV_BYPASS_AUTH: "1" });
    expect((await call(app, "GET", "/session/me", undefined, {})).status).toBe(200);
  });

  it("rate-limits login to 10 attempts per 15 minutes per IP, but not /me", async () => {
    const { app } = await setup();
    const attempt = (ip: string) =>
      call(app, "POST", "/session/login", { email: OWNER.email, password: "wrong password!", client: "web", deviceName: "x" }, { "x-forwarded-for": `${ip}, 10.0.0.1` });
    for (let i = 0; i < 10; i++) expect((await attempt("203.0.113.7")).status).toBe(401);
    const limited = await attempt("203.0.113.7");
    expect(limited.status).toBe(429);
    expect(Number(limited.res.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another IP is unaffected.
    expect((await attempt("198.51.100.2")).status).toBe(401);
    // /me is never throttled.
    for (let i = 0; i < 12; i++) {
      expect((await call(app, "GET", "/session/me", undefined, { "x-forwarded-for": "203.0.113.7" })).status).toBe(401);
    }
  });
});

describe("env", () => {
  it("production requires an argon2 hash", async () => {
    const { parseEnv } = await import("../env");
    const res = parseEnv({
      NODE_ENV: "production",
      OWNER_EMAIL: OWNER.email,
      OWNER_PASSWORD_HASH: "plain",
      SESSION_SECRET: "x".repeat(40),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/OWNER_PASSWORD_HASH/);
  });

  it("lists missing variables", async () => {
    const { parseEnv } = await import("../env");
    const res = parseEnv({ NODE_ENV: "production" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/OWNER_EMAIL: missing/);
      expect(res.message).toMatch(/SESSION_SECRET: missing/);
    }
  });
});
