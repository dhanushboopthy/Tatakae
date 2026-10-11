import { Hono } from "hono";
import type { AppBindings } from "../env";

// GET /api/app/version → { minMobileVersion, latestApkUrl }. Phone app warns (never blocks) when outdated.
export const appVersion = new Hono<AppBindings>();
appVersion.get("/version", async (c) => c.json({ todo: "v4" }, 501));
