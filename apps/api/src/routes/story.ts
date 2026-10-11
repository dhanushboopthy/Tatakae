import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v2. Story refs import/list/mute, watch queue
export const story = new Hono<AppBindings>();

story.get("/", async (c) => c.json({ todo: "v2" }, 501));
story.post("/import", async (c) => c.json({ todo: "v2" }, 501)); // validate: lesson paraphrased, <= 160 chars
story.patch("/:id", async (c) => c.json({ todo: "v2" }, 501));
story.get("/next", async (c) => c.json({ todo: "v2" }, 501));    // ?moment= → core.pickStory
