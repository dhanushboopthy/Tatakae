import { Hono } from "hono";
import type { AppBindings } from "../env";

// Phase v2. Weekly / monthly aggregates
export const stats = new Hono<AppBindings>();

stats.get("/week/:isoWeek", async (c) => c.json({ todo: "v2" }, 501));
stats.get("/month/:yyyymm", async (c) => c.json({ todo: "v2" }, 501));
