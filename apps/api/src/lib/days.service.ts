import type { Db } from "./db";
import type { DayScore, ISODate } from "@tatakae/core";

/** Load day + missions, compute score with core.scoreDay (needs yesterday's missedDay). */
export async function getDayWithScore(db: Db, date: ISODate): Promise<unknown> {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Lock the plan: set forged_at; validate P1 has minimum + ifThen. */
export async function forgeDay(db: Db, date: ISODate): Promise<void> {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Enforce max write-offs per month. */
export async function assertWriteOffAllowed(db: Db, date: ISODate): Promise<void> {
  // TODO(v1)
  throw new Error("not implemented");
}

export async function scoresInRange(db: Db, from: ISODate, to: ISODate): Promise<DayScore[]> {
  // TODO(v2)
  throw new Error("not implemented");
}
