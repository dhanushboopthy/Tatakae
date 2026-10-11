import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. Quick capture
export const inbox = new Hono<AppBindings>();

inbox.get("/", async (c) => c.json({ todo: "v1" }, 501));
inbox.post("/", async (c) => c.json({ todo: "v1" }, 501));
inbox.patch("/:id", async (c) => c.json({ todo: "v1" }, 501)); // process → mission/note
