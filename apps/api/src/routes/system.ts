import { Hono } from "hono";
import { todayIST } from "@tatakae/core";
import type { AppBindings } from "../env";
import { buildExport, listJobs } from "../lib/system.service";

// Phase v4.
//   GET /export        → the full JSON export as a download (same content as the nightly backup)
//   GET /system/jobs   → { runs: JobRun[] } newest first (Settings → Data)
export const exportRoute = new Hono<AppBindings>();

exportRoute.get("/", (c) => {
  c.header("content-disposition", `attachment; filename="tatakae-export-${todayIST()}.json"`);
  c.header("cache-control", "no-store");
  return c.json(buildExport(c.get("db")));
});

export const system = new Hono<AppBindings>();

system.get("/jobs", (c) => c.json({ runs: listJobs(c.get("db")) }));
