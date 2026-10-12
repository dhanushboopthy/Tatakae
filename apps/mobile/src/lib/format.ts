import { weekdayOf, type ISODate } from "@tatakae/core";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** "Monday, 12 October" (device-timezone independent). */
export function longDate(date: ISODate): string {
  const [, m, d] = date.split("-");
  return `${WEEKDAYS[weekdayOf(date)] ?? ""}, ${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
}

/** "Mon 12" for compact history rows. */
export function shortDate(date: ISODate): string {
  const [, , d] = date.split("-");
  return `${(WEEKDAYS[weekdayOf(date)] ?? "").slice(0, 3)} ${Number(d)}`;
}

/** "12 min" / "1 h 05 min" */
export function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/** "3 minutes ago" style, for the sync status line. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
