import { serve } from "@hono/node-server";
import { loadEnv } from "./env";
import { createApp } from "./app";
import { closeDb, openDb, resolveMigrationsFolder, runMigrations } from "./lib/db";
import { startJobs } from "./jobs";
import { signOutEverywhereIfLoginChanged } from "./lib/auth.service";
import { recordSecurityEvent } from "./lib/security.service";

// Entry point inside the Docker container. Caddy terminates TLS and proxies /api here.
const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
runMigrations(db, resolveMigrationsFolder(env.MIGRATIONS_DIR)); // drizzle migrator + default rows, on every boot
// A new password (or owner email) in .env signs every device out; see auth.service.
const revoked = signOutEverywhereIfLoginChanged(db, env.OWNER_EMAIL, env.OWNER_PASSWORD_HASH);
if (revoked > 0) {
  console.log(`login changed in .env: signed out ${revoked} session(s)`);
  recordSecurityEvent(db, { kind: "password_changed", detail: `${revoked} device(s) signed out` });
}
const jobs = startJobs(env, db); // croner, Asia/Kolkata
const app = createApp(env, db);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`tatakae api on :${info.port} (${env.NODE_ENV})`);
});

/** Graceful shutdown: stop crons, stop accepting requests, let in-flight ones finish, close SQLite. */
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  for (const job of jobs) job.stop();

  const force = setTimeout(() => {
    console.error("shutdown timed out after 10 s, exiting");
    closeDb(db);
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close((err) => {
    clearTimeout(force);
    closeDb(db);
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
