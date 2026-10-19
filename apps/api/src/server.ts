import { serve } from "@hono/node-server";
import { loadEnv } from "./env";
import { createApp } from "./app";
import { closeDb, openDb, resolveMigrationsFolder, runMigrations, type Db } from "./lib/db";
import { startJobs } from "./jobs";
import { signOutEverywhereIfLoginChanged } from "./lib/auth.service";
import { recordSecurityEvent } from "./lib/security.service";
import { withWebsite } from "./site";

// Entry point inside the Docker container: behind Caddy on a VM, or directly on Zoho Catalyst AppSail
// (which serves the website from here too, see WEB_DIST). AppSail kills an instance that isn't
// listening within 10 seconds, so bind the port first and open the database right after; requests
// that arrive meanwhile get a 503 "starting".
const env = loadEnv();

let app: { fetch: (req: Request) => Response | Promise<Response> } | null = null;
let db: Db | null = null;
let jobs: ReturnType<typeof startJobs> = [];

const starting = () =>
  new Response(JSON.stringify({ error: "starting", message: "Starting up. Try again in a few seconds." }), {
    status: 503,
    headers: { "content-type": "application/json", "retry-after": "5", "cache-control": "no-store" },
  });

const server = serve({ fetch: (req) => (app ? app.fetch(req) : starting()), port: env.PORT }, (info) => {
  console.log(`tatakae api on :${info.port} (${env.NODE_ENV})`);
});

setImmediate(() => {
  try {
    const t0 = Date.now();
    const replica = env.TURSO_DATABASE_URL
      ? { syncUrl: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN, syncPeriodSec: env.TURSO_SYNC_SECONDS }
      : undefined;
    const opened = openDb(env.DATABASE_PATH, { replica });
    db = opened;
    runMigrations(opened, resolveMigrationsFolder(env.MIGRATIONS_DIR)); // drizzle migrator + default rows, on every boot
    // A new password (or owner email) in the env signs every device out; see auth.service.
    const revoked = signOutEverywhereIfLoginChanged(opened, env.OWNER_EMAIL, env.OWNER_PASSWORD_HASH);
    if (revoked > 0) {
      console.log(`login changed: signed out ${revoked} session(s)`);
      recordSecurityEvent(opened, { kind: "password_changed", detail: `${revoked} device(s) signed out` });
    }
    jobs = startJobs(env, opened); // croner, Asia/Kolkata
    const api = createApp(env, opened);
    app = env.WEB_DIST ? withWebsite(api, env, env.WEB_DIST) : api;
    console.log(`ready in ${Date.now() - t0} ms (${replica ? "Turso replica" : "SQLite file"})`);
  } catch (e) {
    console.error("startup failed:", e);
    process.exit(1);
  }
});

/** Graceful shutdown: stop crons, stop accepting requests, let in-flight ones finish, close SQLite. */
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  for (const job of jobs) job.stop();
  const close = () => {
    if (db) closeDb(db);
  };

  const force = setTimeout(() => {
    console.error("shutdown timed out after 10 s, exiting");
    close();
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close((err) => {
    clearTimeout(force);
    close();
    if (err) console.error("server close failed:", err);
    process.exit(err ? 1 : 0);
  });
  // Keep-alive sockets would otherwise hold close() open until they time out.
  if ("closeIdleConnections" in server && typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
