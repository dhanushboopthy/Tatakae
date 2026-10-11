import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. Batch outbox push + pull changes since cursor
export const sync = new Hono<AppBindings>();

sync.post("/", async (c) => c.json({ todo: "v1" }, 501)); // applySync — body syncRequest (client: web | mobile)
