import { Hono } from "hono";
import type { AppBindings } from "../env";

// GET /api/health (public)
export const health = new Hono<AppBindings>();
health.get("/", (c) => c.json({ ok: true, at: new Date().toISOString() }));
