import { Hono } from "hono";
import { dayPatch, ritualRestartInput, writeOffInput } from "@tatakae/core";
import type { AppBindings } from "../env";
import { forgeDay, getDayWithScore, restartRitual, updateDay } from "../lib/days.service";
import { dateParam, parseBody } from "../lib/validate";

// Phase v1. Every route answers with a DayView: { day, missions, score, yesterdayMissed, firstUseDate }.
//   GET  /:date          day (synthesised default if unsaved) + live missions + score
//   PUT  /:date          dayPatch (+ reason when switching to write_off; max per month → 400)
//   POST /:date/forge    lock the plan; 400 forge_invalid { problems } when P1 is not ready
//   POST /:date/restart  { reason (≥ 20 chars), confirm: "restart" } → unlock the plan to redo the ritual.
//                        Today or later only; once per date (409 restart_used), 2 per 7 days
//                        (409 restart_limit); not locked → 409 not_locked. Logged as a mura event.
export const days = new Hono<AppBindings>();

const dayPut = dayPatch.extend({ reason: writeOffInput.shape.reason.optional() });

days.get("/:date", (c) => {
  const date = dateParam(c);
  return c.json(getDayWithScore(c.get("db"), date));
});

days.put("/:date", async (c) => {
  const date = dateParam(c);
  const body = await parseBody(c, dayPut);
  const db = c.get("db");
  updateDay(db, date, body);
  return c.json(getDayWithScore(db, date));
});

days.post("/:date/forge", (c) => {
  const date = dateParam(c);
  const db = c.get("db");
  forgeDay(db, date);
  return c.json(getDayWithScore(db, date));
});

days.post("/:date/restart", async (c) => {
  const date = dateParam(c);
  const { reason } = await parseBody(c, ritualRestartInput);
  const db = c.get("db");
  restartRitual(db, date, reason);
  return c.json(getDayWithScore(db, date));
});
