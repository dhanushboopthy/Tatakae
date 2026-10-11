import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase 0.
// POST /login  body loginInput { email, password, client, deviceName }
//   client "web"    → Set-Cookie tatakae_session
//   client "mobile" → 200 { token, expiresAt } (loginMobileResponse), no cookie
// POST /logout, GET /me, GET /devices, DELETE /devices/:id (revoke)
export const session = new Hono<AppBindings>();

session.post("/login", async (c) => c.json({ todo: "phase0" }, 501));
session.post("/logout", async (c) => c.json({ todo: "phase0" }, 501));
session.get("/me", async (c) => c.json({ todo: "phase0" }, 501));
session.get("/devices", async (c) => c.json({ todo: "v1" }, 501));
session.delete("/devices/:id", async (c) => c.json({ todo: "v1" }, 501));
