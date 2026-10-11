import { and, eq, isNull } from "drizzle-orm";
import { primaryKeyOf, type Habit, type HabitInput, type HabitLog, type HabitPatch, type ISODate } from "@tatakae/core";
import { habitLogs, habits } from "../../../../db/schema";
import type { Db } from "./db";
import { Conflict, NotFound } from "./errors";
import { newId } from "./ids";
import { bumpUpdatedAt, getRow, softDeleteRow, upsertRow, withoutUndefined } from "./rows.service";

// Habits are tracked, not scored.

export function listHabits(db: Db): Habit[] {
  return db
    .select()
    .from(habits)
    .where(isNull(habits.deletedAt))
    .all()
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function logsOn(db: Db, date: ISODate): HabitLog[] {
  return db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.date, date), isNull(habitLogs.deletedAt)))
    .all();
}

export function requireHabit(db: Db, id: string): Habit {
  const h = getRow(db, "habits", id);
  if (!h || h.deletedAt != null) throw new NotFound("No such habit.");
  return h;
}

export function createHabit(db: Db, input: HabitInput & { id?: string | undefined }, now: Date = new Date()): Habit {
  const id = input.id ?? newId();
  if (getRow(db, "habits", id)) throw new Conflict("A habit with this id already exists.", "exists");
  const { id: _ignored, ...fields } = input;
  return upsertRow(db, "habits", { ...fields, id, updatedAt: now.toISOString(), deletedAt: null });
}

export function patchHabit(db: Db, id: string, patch: HabitPatch, now: Date = new Date()): Habit {
  const prev = requireHabit(db, id);
  return upsertRow(db, "habits", { ...prev, ...withoutUndefined(patch), id, updatedAt: bumpUpdatedAt(prev.updatedAt, now) });
}

export function deleteHabit(db: Db, id: string, now: Date = new Date()): Habit {
  const prev = requireHabit(db, id);
  const deleted = softDeleteRow(db, "habits", id, bumpUpdatedAt(prev.updatedAt, now));
  if (!deleted) throw new NotFound("No such habit.");
  return deleted;
}

/** PUT /habits/:id/logs/:date { done } — upsert by (habitId, date). */
export function setHabitLog(db: Db, habitId: string, date: ISODate, done: boolean, now: Date = new Date()): HabitLog {
  requireHabit(db, habitId);
  const pk = primaryKeyOf("habit_logs", { habitId, date });
  const prev = getRow(db, "habit_logs", pk);
  return upsertRow(db, "habit_logs", { habitId, date, done, updatedAt: bumpUpdatedAt(prev?.updatedAt, now), deletedAt: null });
}
