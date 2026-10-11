import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. Scoring constants editable only on even-week Sundays
export const settings = new Hono<AppBindings>();

settings.get("/", async (c) => c.json({ todo: "v1" }, 501));
settings.put("/:key", async (c) => c.json({ todo: "v1" }, 501));
