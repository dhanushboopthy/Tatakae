import { Hono } from "hono";
import type { AppBindings } from "../env";

// Dashboards, charts, calendar, scoreboard — docs/11. All computation via @tatakae/core stats.ts.
export const stats = new Hono<AppBindings>();

stats.get("/scoreboard", async (c) => c.json({ todo: "v1" }, 501));          // ?date= → MetricBox[]
stats.get("/calendar/:yyyymm", async (c) => c.json({ todo: "v1" }, 501));    // CalendarDay[]
stats.get("/series", async (c) => c.json({ todo: "v1" }, 501));              // ?metric=final|screen_min|focus_min&days=
stats.get("/week/:isoWeek", async (c) => c.json({ todo: "v1" }, 501));       // WeekStats
stats.get("/month/:yyyymm", async (c) => c.json({ todo: "v2" }, 501));       // marks, area minutes
stats.get("/cycle", async (c) => c.json({ todo: "v2" }, 501));               // CycleStats
stats.get("/habits", async (c) => c.json({ todo: "v2" }, 501));              // ?days=84
stats.get("/focus-hours", async (c) => c.json({ todo: "v3" }, 501));
