import { serve } from "@hono/node-server";
import { loadEnv } from "./env";
import { createApp } from "./app";
import { openDb, runMigrations } from "./lib/db";
import { startJobs } from "./jobs";

// Entry point inside the Docker container. Caddy terminates TLS and proxies /api here.
const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
runMigrations(db);            // TODO(phase0): drizzle migrator on boot
startJobs(env, db);           // croner, Asia/Kolkata
const app = createApp(env, db);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`tatakae api on :${info.port}`);
});

// TODO(phase0): graceful shutdown on SIGTERM (close db, stop jobs)
