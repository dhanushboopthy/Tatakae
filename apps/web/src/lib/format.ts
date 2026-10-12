import type { ISODate } from "@tatakae/core";

/** "Tue 20 Oct" for an ISO date (formatted in UTC so the device timezone never shifts it). */
export function formatDay(date: ISODate, opts: { long?: boolean } = {}): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: opts.long ? "long" : "short",
    day: "numeric",
    month: opts.long ? "long" : "short",
    timeZone: "UTC",
  });
}

/** Single-letter weekday, e.g. "T", for compact history rows. */
export function weekdayInitial(date: ISODate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
}

/** localStorage key marking that Welcome back was shown for a date (so "/" doesn't loop). */
export const welcomeBackSeenKey = (date: ISODate) => `tatakae.welcomeBack.${date}`;
