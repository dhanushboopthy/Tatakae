import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v1. GET /:date, PUT /:date, POST /:date/forge
export const days = new Hono<AppBindings>();

days.get("/:date", async (c) => c.json({ todo: "v1" }, 501));      // TODO(v1) getDayWithScore
days.put("/:date", async (c) => c.json({ todo: "v1" }, 501));      // TODO(v1) dayPatch; write_off limit
days.post("/:date/forge", async (c) => c.json({ todo: "v1" }, 501)); // TODO(v1) forgeDay
