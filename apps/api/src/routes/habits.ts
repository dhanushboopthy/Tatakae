import { Hono } from "hono";
import { z } from "zod";
import { habitInput, habitLogInput, habitPatch, isoDate, todayIST } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createHabit, deleteHabit, listHabits, logsOn, patchHabit, setHabitLog } from "../lib/habits.service";
import { dateParam, idParam, parseBody, parseQuery } from "../lib/validate";

// Phase v1. Habits + logs (tracked, not scored)
//   GET    /?date=YYYY-MM-DD        → { habits, logs }  (logs of that date, default today IST)
//   POST   /  habitInput (+ id?)    → 201 { habit }
//   PATCH  /:id  habitPatch         → { habit }
//   DELETE /:id                     → { habit }  (soft delete)
//   PUT    /:id/logs/:date { done } → { log }
export const habits = new Hono<AppBindings>();

habits.get("/", (c) => {
  const q = parseQuery(c, z.object({ date: isoDate.optional() }));
  const db = c.get("db");
  return c.json({ habits: listHabits(db), logs: logsOn(db, q.date ?? todayIST()) });
});

habits.post("/", async (c) => {
  const body = await parseBody(c, habitInput.extend({ id: z.string().min(1).max(64).optional() }));
  return c.json({ habit: createHabit(c.get("db"), body) }, 201);
});

habits.patch("/:id", async (c) => {
  const patch = await parseBody(c, habitPatch);
  return c.json({ habit: patchHabit(c.get("db"), idParam(c), patch) });
});

habits.delete("/:id", (c) => c.json({ habit: deleteHabit(c.get("db"), idParam(c)) }));

habits.put("/:id/logs/:date", async (c) => {
  const date = dateParam(c);
  const body = await parseBody(c, habitLogInput);
  return c.json({ log: setHabitLog(c.get("db"), idParam(c), date, body.done) });
});
