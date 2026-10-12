import { Hono } from "hono";
import type { AppBindings } from "../env";

// GET /api/app/version (public) → { minMobileVersion, latestApkUrl }. Phone app warns (never blocks)
// when outdated. Values come from MIN_MOBILE_VERSION / LATEST_APK_URL (set by the release workflow).
export const appVersion = new Hono<AppBindings>();

appVersion.get("/version", (c) => {
  const env = c.get("env");
  c.header("cache-control", "public, max-age=300");
  return c.json({ minMobileVersion: env.MIN_MOBILE_VERSION, latestApkUrl: env.LATEST_APK_URL ?? null });
});
