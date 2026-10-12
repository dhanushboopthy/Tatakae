import { Hono } from "hono";
import type { AppBindings } from "../env";

// v1. Focus sessions (started/ended/completed) → focus minutes, week planner blocks.
export const focus = new Hono<AppBindings>();
focus.get("/", async (c) => c.json({ todo: "v1" }, 501));      // ?from=&to=
focus.post("/", async (c) => c.json({ todo: "v1" }, 501));
focus.patch("/:id", async (c) => c.json({ todo: "v1" }, 501));
