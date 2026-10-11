import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v2. Weekly Control Room (Muri→Mura→Muda), monthly, cycle
export const reviews = new Hono<AppBindings>();

reviews.get("/", async (c) => c.json({ todo: "v2" }, 501));
reviews.post("/", async (c) => c.json({ todo: "v2" }, 501));
reviews.patch("/:id", async (c) => c.json({ todo: "v2" }, 501));
