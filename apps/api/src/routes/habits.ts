import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. Habits + logs (tracked, not scored)
export const habits = new Hono<AppBindings>();

habits.get("/", async (c) => c.json({ todo: "v1" }, 501));
habits.post("/", async (c) => c.json({ todo: "v1" }, 501));
habits.patch("/:id", async (c) => c.json({ todo: "v1" }, 501));
habits.put("/:id/logs/:date", async (c) => c.json({ todo: "v1" }, 501));
