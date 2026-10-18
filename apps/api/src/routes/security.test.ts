import { describe, expect, it } from "vitest";
import { BODY_LIMITS, bodyLimitFor } from "../middleware/bodyLimit";
import { call, login, OWNER, setup } from "../test/helpers";

// Security hardening (S-series in docs/CHANGELOG.md): body limits, login throttling, CSRF origin
// checks, step-up re-auth, the security event log and signing out other devices.

describe("request body limits", () => {
  it("picks the cap by path", () => {
    expect(bodyLimitFor("/api/session/login")).toBe(BODY_LIMITS.signIn);
    expect(bodyLimitFor("/api/passkeys/login/options")).toBe(BODY_LIMITS.signIn);
    expect(bodyLimitFor("/api/files")).toBe(BODY_LIMITS.files);
    expect(bodyLimitFor("/api/sync")).toBe(BODY_LIMITS.bulk);
    expect(bodyLimitFor("/api/notes")).toBe(BODY_LIMITS.default);
  });

  it("refuses an oversized login body with 413 before parsing it", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/session/login", { email: OWNER.email, password: "x".repeat(100 * 1024), client: "web", deviceName: "x" }, {});
    expect(res.status).toBe(413);
    expect(res.body["error"]).toBe("too_large");
  });

  it("refuses passwords over 256 characters", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/session/login", { email: OWNER.email, password: "x".repeat(300), client: "web", deviceName: "x" }, {});
    expect(res.status).toBe(400);
  });

  it("caps ordinary JSON bodies at 2 MB", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/inbox", { text: "x".repeat(3 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe("login throttling", () => {
  const wrong = (app: Awaited<ReturnType<typeof setup>>["app"], ip: string, password = "wrong password!") =>
    call(app, "POST", "/session/login", { email: OWNER.email, password, client: "mobile", deviceName: "x" }, { "x-forwarded-for": ip });

  it("stops all password guessing after 30 failures an hour, whatever the IP", async () => {
    const { app } = await setup();
    // 3 failures from each of 10 addresses stays under the per-IP limit of 10.
    for (let i = 0; i < 30; i++) expect((await wrong(app, `203.0.113.${Math.floor(i / 3)}`)).status).toBe(401);
    const blocked = await wrong(app, "198.51.100.77");
    expect(blocked.status).toBe(429);
    // Even the right password waits: the window is about guesses, not about who is guessing.
    expect((await wrong(app, "198.51.100.78", OWNER.password)).status).toBe(429);
  });

  it("successful logins don't count", async () => {
    const { app } = await setup();
    for (let i = 0; i < 40; i++) expect((await wrong(app, `198.51.100.${i}`, OWNER.password)).status).toBe(200);
  });
});

describe("cross-site requests (CSRF)", () => {
  const ORIGIN = "https://tatakae.example.me";
  const inbox = { id: "01JCSRFINBOX00000000000001", text: "from a test" };

  it("refuses cookie writes from another origin, allows our own", async () => {
    const { app } = await setup({ PUBLIC_ORIGIN: ORIGIN });
    const web = await login(app, "web");
    const evil = await call(app, "POST", "/inbox", inbox, { ...web, origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    expect(evil.body["error"]).toBe("cross_origin");
    const ok = await call(app, "POST", "/inbox", inbox, { ...web, origin: ORIGIN });
    expect(ok.status).toBeLessThan(300);
  });

  it("uses Sec-Fetch-Site when there is no Origin", async () => {
    const { app } = await setup({ PUBLIC_ORIGIN: ORIGIN });
    const web = await login(app, "web");
    expect((await call(app, "POST", "/inbox", inbox, { ...web, "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await call(app, "POST", "/inbox", inbox, { ...web, "sec-fetch-site": "same-origin" })).status).toBeLessThan(300);
  });

  it("leaves reads and bearer requests alone", async () => {
    const { app } = await setup({ PUBLIC_ORIGIN: ORIGIN });
    const web = await login(app, "web");
    expect((await call(app, "GET", "/session/me", undefined, { ...web, origin: "https://evil.example" })).status).toBe(200);
    const phone = await login(app, "mobile");
    expect((await call(app, "POST", "/inbox", inbox, { ...phone, origin: "https://evil.example" })).status).toBeLessThan(300);
  });

  it("names the cookie __Host- in production", async () => {
    const { app } = await setup({ NODE_ENV: "production", PUBLIC_ORIGIN: ORIGIN });
    const res = await call(app, "POST", "/session/login", { email: OWNER.email, password: OWNER.password, client: "web", deviceName: "laptop-1" }, {});
    const cookie = res.res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-tatakae_session=/);
    expect(cookie).toMatch(/Secure/);
    expect((await call(app, "GET", "/session/me", undefined, { cookie: cookie.split(";")[0] ?? "" })).status).toBe(200);
  });
});
