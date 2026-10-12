import { indexStats, readSettings, todayIST, type ISODate, type StatsIndex } from "@tatakae/core";
import type { Db } from "./db";
import { allRows } from "./rows.service";

// Loads every live row the stats need and indexes them with core indexStats(). One user, a few
// thousand rows at most, so a full read per request is cheap and keeps the numbers identical to
// what the clients compute from their local copies.

export function loadStats(db: Db, today: ISODate = todayIST()): { ix: StatsIndex; settings: ReturnType<typeof readSettings> } {
  const live = { includeDeleted: false } as const;
  const settings = readSettings(allRows(db, "settings", live));
  const ix = indexStats(
    {
      days: allRows(db, "days", live),
      missions: allRows(db, "missions", live),
      focusSessions: allRows(db, "focus_sessions", live),
      habits: allRows(db, "habits", live),
      habitLogs: allRows(db, "habit_logs", live),
      stuckEvents: allRows(db, "stuck_events", live),
      inbox: allRows(db, "inbox", live),
      goals: allRows(db, "goals", live),
      areas: allRows(db, "areas", live),
      muraEvents: allRows(db, "mura_events", live),
    },
    { today, scoring: settings.scoring },
  );
  return { ix, settings };
}
