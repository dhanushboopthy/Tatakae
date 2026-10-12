import { Hono } from "hono";
import { z } from "zod";
import { appDayOf, focusInput, focusPatch, isIsoDate, newId, type FocusSession } from "@tatakae/core";
import type { AppBindings } from "../env";
import { NotFound } from "../lib/errors";
import { allRows, bumpUpdatedAt, getRow, softDeleteRow, upsertRow, withoutUndefined } from "../lib/rows.service";
import { idParam, parseBody, parseQuery } from "../lib/validate";

// v1. Focus sessions (started/ended/completed) → focus minutes, week planner blocks.
//   GET    /?from=&to=   → { sessions } by app day of startedAt (IST, 04:00 boundary), newest first
//   POST   /             focusInput + id? → 201 { session }
//   PATCH  /:id          focusPatch → { session }
//   DELETE /:id          → { session } (soft delete)
export const focus = new Hono<AppBindings>();

const range = z.object({
  from: z.string().refine(isIsoDate, "expected YYYY-MM-DD").optional(),
  to: z.string().refine(isIsoDate, "expected YYYY-MM-DD").optional(),
});

focus.get("/", (c) => {
  const { from, to } = parseQuery(c, range);
  const sessions = allRows(c.get("db"), "focus_sessions", { includeDeleted: false })
    .filter((s) => {
      const d = appDayOf(s.startedAt);
      return (!from || d >= from) && (!to || d <= to);
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return c.json({ sessions });
});

focus.post("/", async (c) => {
  const body = await parseBody(c, focusInput.extend({ id: z.string().min(1).max(64).optional() }));
  const now = new Date().toISOString();
  const session: FocusSession = {
    id: body.id ?? newId(),
    missionId: body.missionId,
    areaId: body.areaId,
    startedAt: body.startedAt ?? now,
    endedAt: null,
    plannedMin: body.plannedMin,
    completed: false,
    updatedAt: now,
    deletedAt: null,
  };
  return c.json({ session: upsertRow(c.get("db"), "focus_sessions", session) }, 201);
});

focus.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = idParam(c);
  const patch = await parseBody(c, focusPatch);
  const prev = getRow(db, "focus_sessions", id);
  if (!prev || prev.deletedAt) throw new NotFound("No such focus session.");
  const session = upsertRow(db, "focus_sessions", {
    ...prev,
    ...withoutUndefined(patch),
    updatedAt: bumpUpdatedAt(prev.updatedAt),
  });
  return c.json({ session });
});

focus.delete("/:id", (c) => {
  const db = c.get("db");
  const prev = getRow(db, "focus_sessions", idParam(c));
  if (!prev || prev.deletedAt) throw new NotFound("No such focus session.");
  return c.json({ session: softDeleteRow(db, "focus_sessions", prev.id, bumpUpdatedAt(prev.updatedAt)) });
});
