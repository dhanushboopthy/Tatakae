import { and, eq, gte, isNull, lte, min, ne, count } from "drizzle-orm";
import {
  addDays,
  daysBetween,
  isMissedDay,
  monthOf,
  monthRange,
  readSettings,
  RITUAL_RESTART,
  scoreDay,
  slotRank,
  SEED_UPDATED_AT,
  todayIST,
  validateForge,
  type Day,
  type DayPatch,
  type DayScore,
  type ISODate,
  type Mission,
  type ScoringSettings,
} from "@tatakae/core";
import { days, missions } from "../../../../db/schema";
import { transaction, type Db } from "./db";
import { BadRequest, Conflict } from "./errors";
import { newId } from "./ids";
import { allRows, bumpUpdatedAt, getRow, upsertRow, withoutUndefined } from "./rows.service";

const bySlot = (a: Mission, b: Mission): number => slotRank(a.slot) - slotRank(b.slot) || a.id.localeCompare(b.id);

/** What a date looks like before anything is saved. updatedAt is the epoch so any real edit wins LWW. */
export function defaultDay(date: ISODate): Day {
  return {
    date,
    kind: "normal",
    screenMin: null,
    smallWin: null,
    qP1: null,
    qDrift: null,
    qPractised: null,
    intention: null,
    energy: null,
    forgedAt: null,
    updatedAt: SEED_UPDATED_AT,
    deletedAt: null,
  };
}

/** Saved, not soft-deleted day row, or null. */
export function getDay(db: Db, date: ISODate): Day | null {
  const row = getRow(db, "days", date);
  return row && row.deletedAt == null ? row : null;
}

export function isForged(db: Db, date: ISODate | null | undefined): boolean {
  if (!date) return false;
  return getDay(db, date)?.forgedAt != null;
}

/** Live missions of a day, P1 → … → P9 → side → backlog. */
export function missionsOn(db: Db, date: ISODate): Mission[] {
  return db
    .select()
    .from(missions)
    .where(and(eq(missions.dayDate, date), isNull(missions.deletedAt)))
    .all()
    .sort(bySlot);
}

/** Live missions without a day (the backlog), oldest first. */
export function backlogMissions(db: Db): Mission[] {
  return db
    .select()
    .from(missions)
    .where(and(isNull(missions.dayDate), isNull(missions.deletedAt)))
    .all()
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function scoringSettings(db: Db): ScoringSettings {
  return readSettings(allRows(db, "settings")).scoring;
}

/** First-use date = earliest saved days.date (shared design). */
export function getFirstUseDate(db: Db): ISODate | null {
  const row = db.select({ first: min(days.date) }).from(days).where(isNull(days.deletedAt)).get();
  return row?.first ?? null;
}

export interface DayView {
  day: Day;
  missions: Mission[];
  score: DayScore;
  yesterdayMissed: boolean;
  firstUseDate: ISODate | null;
}

/** Day (synthesised default if unsaved) + missions + score (core.scoreDay with yesterday's missed-day flag). */
export function getDayWithScore(db: Db, date: ISODate, today: ISODate = todayIST()): DayView {
  const scoring = scoringSettings(db);
  const first = getFirstUseDate(db);
  const saved = getDay(db, date);
  const ms = missionsOn(db, date);
  const yesterday = addDays(date, -1);
  const yesterdayMissed = isMissedDay(
    yesterday,
    getDay(db, yesterday),
    missionsOn(db, yesterday),
    { firstUseDate: first, today },
    scoring,
  );
  const day = saved ?? defaultDay(date);
  return { day, missions: ms, score: scoreDay(day, ms, yesterdayMissed, scoring), yesterdayMissed, firstUseDate: first };
}

/** Write-offs already used in the month of `date`, not counting `date` itself. */
export function writeOffsUsed(db: Db, date: ISODate): number {
  const { start, end } = monthRange(monthOf(date));
  const row = db
    .select({ n: count() })
    .from(days)
    .where(
      and(
        eq(days.kind, "write_off"),
        gte(days.date, start),
        lte(days.date, end),
        ne(days.date, date),
        isNull(days.deletedAt),
      ),
    )
    .get();
  return row?.n ?? 0;
}

/** Enforce max write-offs per month (settings.scoring.writeOffsPerMonth, default 2). */
export function assertWriteOffAllowed(db: Db, date: ISODate, scoring: ScoringSettings = scoringSettings(db)): void {
  const used = writeOffsUsed(db, date);
  if (used >= scoring.writeOffsPerMonth) {
    throw new BadRequest(
      `Write-off days are limited to ${scoring.writeOffsPerMonth} a month.`,
      "write_off_limit",
      { used, limit: scoring.writeOffsPerMonth },
    );
  }
}

/**
 * PUT /days/:date. Turning a day into a write-off needs a reason (kept in qDrift unless the
 * patch sets qDrift) and respects the monthly limit. forgedAt is never set here (see forgeDay).
 */
export function updateDay(db: Db, date: ISODate, input: DayPatch & { reason?: string }, now: Date = new Date()): Day {
  return transaction(db, () => {
    const prev = getDay(db, date) ?? defaultDay(date);
    const { reason, ...patch } = input;
    const next: Day = { ...prev, ...withoutUndefined(patch), date, updatedAt: bumpUpdatedAt(prev.updatedAt, now), deletedAt: null };
    if (next.kind === "write_off" && prev.kind !== "write_off") {
      if (!reason?.trim()) throw new BadRequest("A write-off needs a short reason.", "write_off_reason");
      assertWriteOffAllowed(db, date);
      if (patch.qDrift === undefined && !prev.qDrift) next.qDrift = reason.trim();
    }
    return upsertRow(db, "days", next);
  });
}

/**
 * Lock the plan ("Shutdown complete"): validate with core validateForge (one P1 with Minimum +
 * if-then, no duplicate slots) and set forgedAt to server time. Already forged → unchanged.
 */
export function forgeDay(db: Db, date: ISODate, now: Date = new Date()): Day {
  return transaction(db, () => {
    const prev = getDay(db, date) ?? defaultDay(date);
    if (prev.forgedAt) return prev;
    const problems = validateForge(missionsOn(db, date));
    if (problems.length > 0) throw new BadRequest("The plan is not ready to lock.", "forge_invalid", { problems });
    return upsertRow(db, "days", {
      ...prev,
      forgedAt: now.toISOString(),
      updatedAt: bumpUpdatedAt(prev.updatedAt, now),
      deletedAt: null,
    });
  });
}

/**
 * Restart the night ritual: unlock a forged plan for `date` (today or later). Rare by design: once per
 * date, at most RITUAL_RESTART.perWeek in any 7 days, and logged as a mura event against the day's P1
 * (reason prefixed "Ritual restarted: ") so it shows in Sunday's review. Validation of the reason and the
 * typed confirmation is done by `ritualRestartInput` at the route.
 */
export function restartRitual(db: Db, date: ISODate, reason: string, now: Date = new Date()): Day {
  return transaction(db, () => {
    if (date < todayIST(now)) throw new BadRequest("Past days stay as they were.", "past_day");
    const prev = getDay(db, date);
    if (!prev?.forgedAt) throw new Conflict("That plan isn't locked, so there's nothing to restart.", "not_locked");

    const dayOf = new Map(allRows(db, "missions").map((m) => [m.id, m.dayDate]));
    const restarts = allRows(db, "mura_events", { includeDeleted: false }).filter((e) => e.reason.startsWith(RITUAL_RESTART.reasonPrefix));
    if (restarts.some((e) => dayOf.get(e.missionId) === date || e.missionId === `day:${date}`)) {
      throw new Conflict("This plan was already restarted once. Keep it, or change single missions with a reason.", "restart_used");
    }
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const recent = restarts.filter((e) => Date.parse(e.at) > weekAgo).length;
    if (recent >= RITUAL_RESTART.perWeek) {
      throw new Conflict(`The ritual can be restarted ${RITUAL_RESTART.perWeek} times in 7 days. Keep this plan.`, "restart_limit", { recent });
    }

    const ms = missionsOn(db, date);
    const anchorId = ms.find((m) => m.slot === "P1")?.id ?? ms[0]?.id ?? `day:${date}`;
    const at = now.toISOString();
    upsertRow(db, "mura_events", {
      id: newId(),
      missionId: anchorId,
      reason: `${RITUAL_RESTART.reasonPrefix}${reason.trim()}`,
      at,
      updatedAt: at,
      deletedAt: null,
    });
    return upsertRow(db, "days", { ...prev, forgedAt: null, updatedAt: bumpUpdatedAt(prev.updatedAt, now), deletedAt: null });
  });
}

export interface DatedScore {
  date: ISODate;
  score: DayScore;
  /** Missed-day rule incl. unsaved days after first use (core isMissedDay). */
  missed: boolean;
}

/** Scores for every date in [from, to] (max 400 days), each with the comeback rule from the day before. */
export function scoresInRange(db: Db, from: ISODate, to: ISODate, today: ISODate = todayIST()): DatedScore[] {
  const span = daysBetween(from, to);
  if (span < 0 || span > 400) throw new BadRequest("Range must be 0–400 days.", "invalid_range");
  const start = addDays(from, -1);
  const scoring = scoringSettings(db);
  const ctx = { firstUseDate: getFirstUseDate(db), today };

  const dayMap = new Map<ISODate, Day>();
  for (const d of db
    .select()
    .from(days)
    .where(and(gte(days.date, start), lte(days.date, to), isNull(days.deletedAt)))
    .all()) {
    dayMap.set(d.date, d);
  }
  const msMap = new Map<ISODate, Mission[]>();
  for (const m of db
    .select()
    .from(missions)
    .where(and(gte(missions.dayDate, start), lte(missions.dayDate, to), isNull(missions.deletedAt)))
    .all()) {
    if (!m.dayDate) continue;
    const list = msMap.get(m.dayDate) ?? [];
    list.push(m);
    msMap.set(m.dayDate, list);
  }

  let prevMissed = isMissedDay(start, dayMap.get(start) ?? null, msMap.get(start) ?? [], ctx, scoring);
  const out: DatedScore[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = dayMap.get(d) ?? null;
    const ms = msMap.get(d) ?? [];
    const score = scoreDay(day ?? defaultDay(d), ms, prevMissed, scoring);
    const missed = isMissedDay(d, day, ms, ctx, scoring);
    out.push({ date: d, score, missed });
    prevMissed = missed;
  }
  return out;
}
