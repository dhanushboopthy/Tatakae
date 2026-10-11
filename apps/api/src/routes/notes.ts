import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v3. Notes CRUD + FTS5 search
export const notes = new Hono<AppBindings>();

notes.get("/", async (c) => c.json({ todo: "v3" }, 501));
notes.get("/search", async (c) => c.json({ todo: "v3" }, 501));
notes.post("/", async (c) => c.json({ todo: "v3" }, 501));
notes.patch("/:id", async (c) => c.json({ todo: "v3" }, 501));
