import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessions } from "../../../../db/schema";
import { hashToken, REAUTH_WINDOW_MS } from "../lib/auth.service";
import type { Db } from "../lib/db";
import { BODY_LIMITS, bodyLimitFor } from "../middleware/bodyLimit";
import { call, login, OWNER, setup } from "../test/helpers";

/** Pretend the bearer session's last password check was `minutes` ago (null = never). */
function ageAuth(db: Db, headers: Record<string, string>, minutes: number | null): void {
  const token = (headers["authorization"] ?? "").replace("Bearer ", "");
  const authAt = minutes === null ? null : new Date(Date.now() - minutes * 60_000).toISOString();
  db.update(sessions).set({ authAt }).where(eq(sessions.id, hashToken(token))).run();
}

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

describe("step-up re-auth", () => {
  const stale = REAUTH_WINDOW_MS / 60_000 + 1;

  it("a fresh login can do sensitive things straight away", async () => {
    const { app } = await setup();
    const phone = await login(app, "mobile");
    expect((await call(app, "GET", "/export", undefined, phone)).status).toBe(200);
  });

  it("a stale session needs the password again for export, passkeys and other devices", async () => {
    const { app, db } = await setup();
    const phone = await login(app, "mobile", "phone");
    const laptop = await login(app, "mobile", "laptop-as-script");
    ageAuth(db, phone, stale);

    const exp = await call(app, "GET", "/export", undefined, phone);
    expect(exp.status).toBe(403);
    expect(exp.body["error"]).toBe("reauth_required");
    expect((await call(app, "POST", "/passkeys/register/options", {}, phone)).status).toBe(403);
    const devices = (await call(app, "GET", "/session/devices", undefined, phone)).body["devices"] as { id: string; deviceName: string }[];
    const other = devices.find((d) => d.deviceName === "laptop-as-script");
    expect((await call(app, "DELETE", `/session/devices/${other?.id ?? ""}`, undefined, phone)).status).toBe(403);
    expect((await call(app, "GET", "/session/me", undefined, laptop)).status).toBe(200); // untouched

    // Ordinary work and reads don't ask.
    expect((await call(app, "GET", "/session/me", undefined, phone)).status).toBe(200);
    expect((await call(app, "POST", "/inbox", { text: "still works" }, phone)).status).toBeLessThan(300);
  });

  it("sessions from before step-up existed (no auth_at) count as stale", async () => {
    const { app, db } = await setup();
    const phone = await login(app, "mobile");
    ageAuth(db, phone, null);
    expect((await call(app, "GET", "/export", undefined, phone)).status).toBe(403);
  });

  it("signing out this device itself never asks", async () => {
    const { app, db } = await setup();
    const phone = await login(app, "mobile", "phone");
    ageAuth(db, phone, stale);
    const devices = (await call(app, "GET", "/session/devices", undefined, phone)).body["devices"] as { id: string; current: boolean }[];
    const me = devices.find((d) => d.current);
    expect((await call(app, "DELETE", `/session/devices/${me?.id ?? ""}`, undefined, phone)).status).toBe(200);
  });

  it("a wrong password is 403 (the device stays signed in); the right one opens the window", async () => {
    const { app, db } = await setup();
    const phone = await login(app, "mobile");
    ageAuth(db, phone, stale);

    const wrongPw = await call(app, "POST", "/session/reauth", { password: "not it at all" }, phone);
    expect(wrongPw.status).toBe(403);
    expect(wrongPw.body["error"]).toBe("wrong_password");
    expect((await call(app, "GET", "/session/me", undefined, phone)).status).toBe(200);

    const ok = await call(app, "POST", "/session/reauth", { password: OWNER.password }, phone);
    expect(ok.status).toBe(200);
    expect(typeof ok.body["authAt"]).toBe("string");
    expect((await call(app, "GET", "/export", undefined, phone)).status).toBe(200);
  });

  it("reauth needs a session and is throttled like login", async () => {
    const { app } = await setup();
    expect((await call(app, "POST", "/session/reauth", { password: OWNER.password }, {})).status).toBe(401);
    const phone = await login(app, "mobile");
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await call(app, "POST", "/session/reauth", { password: "wrong" }, { ...phone, "x-forwarded-for": "203.0.113.9" })).status;
    expect(last).toBe(429);
  });
});

describe("stored links", () => {
  it("only accept http(s) links", async () => {
    const { app } = await setup();
    const base = { company: "Acme", role: "SRE" };
    expect((await call(app, "POST", "/applications", { ...base, url: "javascript:alert(1)" })).status).toBe(400);
    expect((await call(app, "POST", "/applications", { ...base, url: "data:text/html,hi" })).status).toBe(400);
    expect((await call(app, "POST", "/notes", { title: "x", sourceUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await call(app, "POST", "/applications", { ...base, url: "https://jobs.example/1" })).status).toBe(201);
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
