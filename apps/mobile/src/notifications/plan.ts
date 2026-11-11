import { addDays, type ISODate } from "@tatakae/core";

// Which local reminders to schedule (docs/05 "Notifications (max 3/day)"). Pure, so it is tested
// without the native module: local.ts feeds it the local store and hands the result to expo-notifications.

export type ReminderKind = "morning" | "afternoon" | "ritual";

export interface Reminder {
  /** Stable per day and kind, e.g. "2026-10-19:morning" (used to tell which ones were opened). */
  key: string;
  kind: ReminderKind;
  date: ISODate;
  at: Date;
  title: string;
  body: string;
  /** Route opened when tapped. */
  url: "/morning" | "/" | "/quick-close";
}

export interface DayInput {
  date: ISODate;
  /** rest / write-off days get no reminders. */
  kind: "normal" | "rest" | "write_off";
  /** Live P1 title for the day, if planned. */
  p1Title: string | null;
  /** P1 is still open (not done / minimum / missed / rescheduled). */
  p1Open: boolean;
  /** A focus block on P1 started, or P1 got Done / Minimum. */
  p1Started: boolean;
  /** Day closed (laptop ritual done = plan for tomorrow forged, or Quick close). */
  closed: boolean;
}

export interface PlanInput {
  now: Date;
  wake: string; // "HH:MM" IST
  ritual: string; // "HH:MM" IST
  afternoon: { enabled: boolean; time: string };
  /** Today first, then the next days (normally today + tomorrow). */
  days: readonly DayInput[];
}

const IST_OFFSET_MIN = 330;
export const MAX_PER_DAY = 3;

/**
 * The instant of "HH:MM" IST on app day `date`. The app day runs 04:00 → 04:00 IST, so a time before
 * 04:00 (a ritual at 00:30) falls on the next calendar date.
 */
export function istInstant(date: ISODate, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const cal = hhmm < "04:00" ? addDays(date, 1) : date;
  const [y, mo, d] = cal.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0) - IST_OFFSET_MIN * 60_000);
}

/** Future reminders only, at most three a day, never on rest or written-off days. No guilt copy. */
export function planReminders(input: PlanInput): Reminder[] {
  const out: Reminder[] = [];
  input.days.forEach((d, i) => {
    if (d.kind !== "normal") return;
    const today = i === 0;
    const day: Reminder[] = [];
    day.push({
      key: `${d.date}:morning`,
      kind: "morning",
      date: d.date,
      at: istInstant(d.date, input.wake),
      title: d.p1Title ? `P1: ${d.p1Title}. Start?` : "Good morning",
      body: d.p1Title ? "One block is enough to start." : "What would make today a win? Pick one mission.",
      url: "/morning",
    });
    // The afternoon nudge needs to know P1 hasn't started, so only today's is ever planned.
    if (today && input.afternoon.enabled && d.p1Title && d.p1Open && !d.p1Started) {
      day.push({
        key: `${d.date}:afternoon`,
        kind: "afternoon",
        date: d.date,
        at: istInstant(d.date, input.afternoon.time),
        title: `P1 is still open: ${d.p1Title}`,
        body: "The Minimum counts. Five minutes is a start.",
        url: "/",
      });
    }
    if (!d.closed) {
      day.push({
        key: `${d.date}:ritual`,
        kind: "ritual",
        date: d.date,
        at: istInstant(d.date, input.ritual),
        title: `Laptop ritual at ${input.ritual}`,
        body: "Away from the laptop? Quick close here in under a minute.",
        url: "/quick-close",
      });
    }
    out.push(...day.slice(0, MAX_PER_DAY));
  });
  return out.filter((r) => r.at.getTime() > input.now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Count reminders that fired and were not opened, newest first, stopping at the first opened one.
 * Two in a row → Today asks once whether to change the times.
 */
export function ignoredInARow(fired: readonly { key: string; at: number }[], opened: ReadonlySet<string>, now: number): number {
  let n = 0;
  for (const f of [...fired].filter((x) => x.at <= now).sort((a, b) => b.at - a.at)) {
    if (opened.has(f.key)) break;
    n++;
  }
  return n;
}
