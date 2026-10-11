import { Hono } from "hono";
import { z } from "zod";
import { isoDate, lockedEdit, missionInput, missionPatch } from "@tatakae/core";
import type { AppBindings } from "../env";
import { backlogMissions, missionsOn } from "../lib/days.service";
import { BadRequest } from "../lib/errors";
import {
  createMission,
  deleteMission,
  patchMission,
  rescheduleMission,
} from "../lib/missions.service";
import { idParam, parseBody, parseQuery } from "../lib/validate";

// Phase v1. Missions with the plan lock (423 plan_locked when a forged day's plan changes without a reason).
//   GET    /?date=YYYY-MM-DD | /?backlog=1   → { missions }
//   POST   /                    missionInput (+ id?, reason?)          → 201 { mission, muraEvent }
//   PATCH  /:id                 missionPatch                           → { mission, muraEvent: null }
//   POST   /:id/edit-locked     lockedEdit { reason, patch }           → { mission, muraEvent }
//   DELETE /:id?reason=…        soft delete                            → { mission, muraEvent }
//   POST   /:id/reschedule                                             → { mission, backlog }
export const missions = new Hono<AppBindings>();

const reason = z.string().min(3).max(300);
const listQuery = z.object({ date: isoDate.optional(), backlog: z.enum(["1", "true"]).optional() });
const createBody = missionInput.extend({ id: z.string().min(1).max(64).optional(), reason: reason.optional() });

missions.get("/", (c) => {
  const q = parseQuery(c, listQuery);
  const db = c.get("db");
  if (q.date) return c.json({ missions: missionsOn(db, q.date) });
  if (q.backlog) return c.json({ missions: backlogMissions(db) });
  throw new BadRequest("Pass ?date=YYYY-MM-DD or ?backlog=1.");
});

missions.post("/", async (c) => {
  const { reason: why, ...input } = await parseBody(c, createBody);
  return c.json(createMission(c.get("db"), input, why), 201);
});

missions.patch("/:id", async (c) => {
  const patch = await parseBody(c, missionPatch);
  return c.json(patchMission(c.get("db"), idParam(c), patch));
});

missions.post("/:id/edit-locked", async (c) => {
  const body = await parseBody(c, lockedEdit);
  return c.json(patchMission(c.get("db"), idParam(c), body.patch, body.reason));
});

missions.delete("/:id", (c) => {
  const q = parseQuery(c, z.object({ reason: reason.optional() }));
  return c.json(deleteMission(c.get("db"), idParam(c), q.reason));
});

missions.post("/:id/reschedule", (c) => {
  return c.json(rescheduleMission(c.get("db"), idParam(c)));
});
