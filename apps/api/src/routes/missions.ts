import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. CRUD + POST /:id/edit-locked (reason → mura_events)
export const missions = new Hono<AppBindings>();

missions.get("/", async (c) => c.json({ todo: "v1" }, 501));       // ?date= | ?backlog=1
missions.post("/", async (c) => c.json({ todo: "v1" }, 501));      // missionInput
missions.patch("/:id", async (c) => c.json({ todo: "v1" }, 501));  // 423 if day forged
missions.post("/:id/edit-locked", async (c) => c.json({ todo: "v1" }, 501)); // lockedEdit
missions.delete("/:id", async (c) => c.json({ todo: "v1" }, 501));
