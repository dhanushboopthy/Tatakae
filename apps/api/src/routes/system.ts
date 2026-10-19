import { Hono } from "hono";
import { todayIST } from "@tatakae/core";
import type { AppBindings } from "../env";
import { buildExport, listJobs } from "../lib/system.service";
import { requireRecentAuth } from "../middleware/auth";

// Phase v4.
//   GET /export        → the full JSON export as a download (same content as the nightly backup);
//                        needs a recent password/passkey check (403 reauth_required otherwise)
//   GET /system/jobs   → { runs: JobRun[] } newest first (Settings → Data)
export const exportRoute = new Hono<AppBindings>();

exportRoute.get("/", (c) => {
  requireRecentAuth(c); // everything in one file: worth a password check
  c.header("content-disposition", `attachment; filename="tatakae-export-${todayIST()}.json"`);
  c.header("cache-control", "no-store");
  return c.json(buildExport(c.get("db")));
});

export const system = new Hono<AppBindings>();

system.get("/jobs", (c) => c.json({ runs: listJobs(c.get("db")) }));
