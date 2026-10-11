import {
  isLockedChange,
  reschedule,
  type MissionInput,
  type MissionPatch,
  type Mission,
  type MuraEvent,
} from "@tatakae/core";
import { transaction, type Db } from "./db";
import { isForged } from "./days.service";
import { BadRequest, Conflict, Locked, NotFound } from "./errors";
import { newId } from "./ids";
import { bumpUpdatedAt, getRow, upsertRow, withoutUndefined } from "./rows.service";

// Mission writes with the server-authoritative plan lock (shared design):
// on a forged day, changing title/slot/points/minimum/ifThen/dayDate, creating or deleting a
// mission needs a reason, which is stored as a mura event. Free fields never need one.

export interface MissionWrite {
  mission: Mission;
  muraEvent: MuraEvent | null;
}

/** Live mission or 404. */
export function requireMission(db: Db, id: string): Mission {
  const m = getRow(db, "missions", id);
  if (!m || m.deletedAt != null) throw new NotFound("No such mission.");
  return m;
}

/** Does prev → next change a locked plan (previous or next day forged)? */
export function isLockedWrite(db: Db, prev: Mission | null, next: Mission): boolean {
  const forged = isForged(db, prev?.dayDate) || isForged(db, next.dayDate);
  return isLockedChange(prev, next, forged);
}

export function recordMura(db: Db, missionId: string, reason: string, now: Date = new Date()): MuraEvent {
  const at = now.toISOString();
  return upsertRow(db, "mura_events", { id: newId(), missionId, reason: reason.trim(), at, updatedAt: at, deletedAt: null });
}

/** Write a mission; locked changes need `reason` (→ mura event), else 423. */
export function writeMission(db: Db, prev: Mission | null, next: Mission, reason?: string, now: Date = new Date()): MissionWrite {
  return transaction(db, () => {
    const locked = isLockedWrite(db, prev, next);
    if (locked && !reason?.trim()) {
      throw new Locked("This day's plan is locked. Changing it needs a short reason.", "plan_locked", { missionId: next.id });
    }
    const mission = upsertRow(db, "missions", next);
    const muraEvent = locked && reason ? recordMura(db, mission.id, reason, now) : null;
    return { mission, muraEvent };
  });
}

export function createMission(
  db: Db,
  input: MissionInput & { id?: string | undefined },
  reason?: string,
  now: Date = new Date(),
): MissionWrite {
  const id = input.id ?? newId();
  if (getRow(db, "missions", id)) throw new Conflict("A mission with this id already exists.", "exists");
  const backlog = input.dayDate == null || input.slot === "backlog";
  const at = now.toISOString();
  const mission: Mission = {
    id,
    title: input.title.trim(),
    dayDate: input.dayDate,
    slot: input.slot,
    points: input.points,
    status: backlog ? "backlog" : "open",
    minimum: input.minimum,
    ifThen: input.ifThen,
    resumeNote: null,
    goalId: input.goalId,
    estMin: input.estMin,
    actualMin: null,
    rescheduleCount: 0,
    updatedAt: at,
    deletedAt: null,
  };
  return writeMission(db, null, mission, reason, now);
}

export function patchMission(db: Db, id: string, patch: MissionPatch, reason?: string, now: Date = new Date()): MissionWrite {
  const prev = requireMission(db, id);
  const next: Mission = { ...prev, ...withoutUndefined(patch), id, updatedAt: bumpUpdatedAt(prev.updatedAt, now) };
  return writeMission(db, prev, next, reason, now);
}

export function deleteMission(db: Db, id: string, reason?: string, now: Date = new Date()): MissionWrite {
  const prev = requireMission(db, id);
  const at = bumpUpdatedAt(prev.updatedAt, now);
  return writeMission(db, prev, { ...prev, updatedAt: at, deletedAt: at }, reason, now);
}

/** Reschedule chip (core reschedule): original → rescheduled, plus a backlog copy carrying the count. */
export function rescheduleMission(db: Db, id: string, now: Date = new Date()): { mission: Mission; backlog: Mission } {
  const prev = requireMission(db, id);
  if (prev.dayDate == null) throw new BadRequest("Backlog items have no day to move from.", "not_scheduled");
  if (prev.status === "rescheduled") throw new Conflict("Already rescheduled.", "already_rescheduled");
  const [original, copy] = reschedule(prev);
  const at = bumpUpdatedAt(prev.updatedAt, now);
  return transaction(db, () => {
    // Status and rescheduleCount are free fields; the copy has no day, so no lock applies.
    const mission = writeMission(db, prev, { ...original, updatedAt: at }, undefined, now).mission;
    const backlog = writeMission(db, null, { ...copy, updatedAt: at }, undefined, now).mission;
    return { mission, backlog };
  });
}
