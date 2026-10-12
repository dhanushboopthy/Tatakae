import { daysBetween, todayIST, type ISODate } from "@tatakae/core";

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

/** "Captured today" / "Captured yesterday" / "Captured 4 days ago", in app days (IST, 04:00 boundary). */
export function appDayAge(iso: string, now: Date = new Date()): string {
  const n = daysBetween(todayIST(new Date(iso)), todayIST(now));
  if (n <= 0) return "Captured today";
  if (n === 1) return "Captured yesterday";
  return `Captured ${n} days ago`;
}

/** localStorage key marking that Welcome back was shown for a date (so "/" doesn't loop). */
export const welcomeBackSeenKey = (date: ISODate) => `tatakae.welcomeBack.${date}`;
