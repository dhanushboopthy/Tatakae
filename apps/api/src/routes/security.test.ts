import { describe, expect, it } from "vitest";
import { BODY_LIMITS, bodyLimitFor } from "../middleware/bodyLimit";
import { call, OWNER, setup } from "../test/helpers";

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
