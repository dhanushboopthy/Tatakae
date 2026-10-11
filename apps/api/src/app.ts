import { Hono } from "hono";
import type { AppBindings, Env } from "./env";
import type { Db } from "./lib/db";
import { auth } from "./middleware/auth";
import { errors } from "./middleware/errors";
import { rateLimit } from "./middleware/rateLimit";
import { health } from "./routes/health";
import { session } from "./routes/session";
import { days } from "./routes/days";
import { missions } from "./routes/missions";
import { habits } from "./routes/habits";
import { inbox } from "./routes/inbox";
import { settings } from "./routes/settings";
import { sync } from "./routes/sync";
import { stats } from "./routes/stats";
import { reviews } from "./routes/reviews";
import { story } from "./routes/story";
import { notes } from "./routes/notes";
import { appVersion } from "./routes/appVersion";

export function createApp(env: Env, db: Db) {
  const app = new Hono<AppBindings>().basePath("/api");

  app.onError(errors);
  app.notFound((c) => c.json({ error: "not_found", message: "No such endpoint." }, 404));
  app.use("*", async (c, next) => {
    c.set("env", env);
    c.set("db", db);
    c.set("session", null);
    c.set("email", "");
    await next();
  });

  app.route("/health", health);                            // public
  // Login only (not /me): 10 attempts per 15 min per IP. One limiter per app instance.
  app.use("/session/login", rateLimit({ windowSec: 900, max: 10, methods: ["POST"] }));
  app.route("/session", session);                          // login public; me/logout/devices apply auth inside
  app.route("/app", appVersion);                           // public: mobile update check
  app.use("*", auth);                                      // everything below needs a session

  // v1
  app.route("/days", days);
  app.route("/missions", missions);
  app.route("/habits", habits);
  app.route("/inbox", inbox);
  app.route("/settings", settings);
  app.route("/sync", sync);
  // v2
  app.route("/stats", stats);
  app.route("/reviews", reviews);
  app.route("/story", story);
  // v3
  app.route("/notes", notes);
  // TODO(v2): goals, areas, experiments, stuck  TODO(v3): files  TODO(v4): push, export

  return app;
}
