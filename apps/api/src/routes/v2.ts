import { Hono } from "hono";
import { z } from "zod";
import {
  appDayOf,
  areaInput,
  areaPatch,
  experimentInput,
  experimentPatch,
  goalInput,
  goalPatch,
  isoDate,
  stuckInput,
  todayIST,
  type StuckEvent,
} from "@tatakae/core";
import type { AppBindings } from "../env";
import { crudRoutes, liveRows } from "../lib/crud";
import { BadRequest, Conflict } from "../lib/errors";
import { assertGoal } from "../lib/goals.service";
import { newId } from "../lib/ids";
import { upsertRow } from "../lib/rows.service";
import { parseBody, parseQuery } from "../lib/validate";

// Phase v2 resources over the generic CRUD (lib/crud.ts):
//   /goals        max 4 active per cycle, and only goals that passed the hell-yeah gate can be active
//   /areas        name, why, standard, alignment, colour + icon
//   /experiments  one running experiment at a time (two weeks by default)
//   /stuck        GET ?from=&to= → { items }; POST stuckInput → 201 { item }

export const goals = crudRoutes({
  table: "goals",
  input: goalInput,
  patch: goalPatch,
  label: "goal",
  sort: (a, b) => a.name.localeCompare(b.name),
  guard: assertGoal,
});

export const areas = crudRoutes({
  table: "areas",
  input: areaInput,
  patch: areaPatch,
  label: "area",
  sort: (a, b) => a.name.localeCompare(b.name),
});

export const experiments = crudRoutes({
  table: "experiments",
  input: experimentInput,
  patch: experimentPatch,
  label: "experiment",
  sort: (a, b) => b.start.localeCompare(a.start),
  guard: (db, next, prev) => {
    if (next.end < next.start) throw new BadRequest("An experiment ends after it starts.", "invalid_range");
    if (prev) return;
    const today = todayIST();
    const running = liveRows(db, "experiments").find((e) => e.decision == null && e.end >= today && e.id !== next.id);
    if (running) throw new Conflict("One experiment at a time. Close the running one with a decision first.", "experiment_running", { id: running.id });
  },
});

export const stuck = new Hono<AppBindings>();

stuck.get("/", (c) => {
  const { from, to } = parseQuery(c, z.object({ from: isoDate.optional(), to: isoDate.optional() }));
  const items = liveRows(c.get("db"), "stuck_events")
    .filter((e) => {
      const d = appDayOf(e.at);
      return (!from || d >= from) && (!to || d <= to);
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  return c.json({ items });
});

stuck.post("/", async (c) => {
  const body = await parseBody(c, stuckInput.extend({ id: z.string().min(1).max(64).optional() }));
  const now = new Date().toISOString();
  const row: StuckEvent = {
    id: body.id ?? newId(),
    missionId: body.missionId,
    blocker: body.blocker,
    unblocker: body.unblocker,
    at: now,
    updatedAt: now,
    deletedAt: null,
  };
  return c.json({ item: upsertRow(c.get("db"), "stuck_events", row) }, 201);
});
