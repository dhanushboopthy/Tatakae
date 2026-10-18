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
