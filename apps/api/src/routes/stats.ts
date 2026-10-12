import { Hono } from "hono";
import { z } from "zod";
import {
  calendarMonth,
  cycleFor,
  cycleStats,
  focusHours,
  habitGrid,
  isIsoDate,
  monthStats,
  parseIsoWeek,
  scoreboard,
  series,
  seriesQuery,
  todayIST,
  weekStats,
} from "@tatakae/core";
import type { AppBindings } from "../env";
import { BadRequest } from "../lib/errors";
import { loadStats } from "../lib/stats.service";
import { parseQuery } from "../lib/validate";

// Dashboards, charts, calendar, scoreboard — docs/11 §5. All computation via @tatakae/core stats.ts.
//   GET /scoreboard?date=              → { date, boxes: MetricBox[] }
//   GET /calendar/:yyyymm              → { month, days: CalendarDay[] }
//   GET /series?metric=&days=          → Series
//   GET /week/:isoWeek                 → WeekStats ("2026-W43")
//   GET /month/:yyyymm                 → MonthStats
//   GET /cycle?date=                   → CycleStats (cycle containing date, default today)
//   GET /habits?days=                  → HabitGrid
//   GET /focus-hours                   → { counts: number[7][24] } (0 = Sunday, IST)
export const stats = new Hono<AppBindings>();

const MONTH = /^\d{4}-?(0[1-9]|1[0-2])$/;

function monthParam(value: string | undefined): string {
  if (!value || !MONTH.test(value)) throw new BadRequest("Expected a month like 2026-10.", "invalid_month");
  return value;
}

const optionalDate = z.object({
  date: z
    .string()
    .refine(isIsoDate, "expected YYYY-MM-DD")
    .optional(),
});

stats.get("/scoreboard", (c) => {
  const { date } = parseQuery(c, optionalDate);
  const { ix, settings } = loadStats(c.get("db"));
  const d = date ?? todayIST();
  return c.json({ date: d, boxes: scoreboard(ix, { date: d, focusWeekTarget: settings.focus_week_target }) });
});

stats.get("/calendar/:yyyymm", (c) => {
  const month = monthParam(c.req.param("yyyymm"));
  const { ix } = loadStats(c.get("db"));
  return c.json({ month, days: calendarMonth(ix, month) });
});

stats.get("/series", (c) => {
  const q = parseQuery(c, seriesQuery);
  const { ix } = loadStats(c.get("db"));
  return c.json(series(ix, q.metric, q.days));
});

stats.get("/week/:isoWeek", (c) => {
  const week = parseIsoWeek(c.req.param("isoWeek") ?? "");
  if (!week) throw new BadRequest("Expected an ISO week like 2026-W43.", "invalid_week");
  const { ix } = loadStats(c.get("db"));
  return c.json(weekStats(ix, week));
});

stats.get("/month/:yyyymm", (c) => {
  const month = monthParam(c.req.param("yyyymm"));
  const { ix } = loadStats(c.get("db"));
  return c.json(monthStats(ix, month));
});

stats.get("/cycle", (c) => {
  const { date } = parseQuery(c, optionalDate);
  const { ix } = loadStats(c.get("db"));
  return c.json(cycleStats(ix, cycleFor(date ?? todayIST())));
});

stats.get("/habits", (c) => {
  const { days } = parseQuery(c, z.object({ days: z.coerce.number().int().min(1).max(400).default(84) }));
  const { ix } = loadStats(c.get("db"));
  return c.json(habitGrid(ix, days));
});

stats.get("/focus-hours", (c) => {
  const { ix } = loadStats(c.get("db"));
  return c.json({ counts: focusHours(ix) });
});
