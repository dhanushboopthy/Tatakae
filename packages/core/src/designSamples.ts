import { addDays } from "./time";
import { dateRange, type CalendarDay, type CalendarState, type HabitGrid, type MetricBox, type SeriesPoint, type WeekMark } from "./stats";
import type { ISODate } from "./types";

// Fixed sample data for the /dev/design pages (web and phone, docs/06 v2.0): every component from
// docs/10 §5 and docs/11 rendered with the same numbers on both clients. Deterministic (no clock, no
// randomness), never written to the store, never shown outside the design pages.

const TODAY: ISODate = "2026-10-22";
const MONTH = "2026-10";

// Strong / Solid / Light / Missed / Rest pattern for Oct 1–21 (the mockups' month).
const PATTERN: readonly CalendarState[] = [
  "Light", "Solid", "Missed", "Rest", "Strong", "Solid", "Strong",
  "Light", "Solid", "Missed", "Rest", "Strong", "Solid", "Strong",
  "Solid", "Light", "Solid", "Rest", "Strong", "Solid", "Light",
];

const FINAL: Partial<Record<CalendarState, number>> = { Strong: 86, Solid: 64, Light: 38, Missed: 0 };

function day(date: ISODate, state: CalendarState, i: number): CalendarDay {
  const scored = state === "Strong" || state === "Solid" || state === "Light" || state === "Missed";
  return {
    date,
    state,
    kind: state === "Rest" ? "rest" : state === "WriteOff" ? "write_off" : "normal",
    final: scored ? (FINAL[state] ?? null) : null,
    done: state === "Strong" ? 6 : state === "Solid" ? 3 : state === "Light" ? 1 : 0,
    minimum: state === "Solid" ? 2 : state === "Light" ? 2 : 0,
    missed: state === "Missed" ? 4 : state === "Light" ? 2 : 0,
    open: state === "Today" ? 3 : 0,
    screenMin: scored ? 80 + ((i * 37) % 140) : null,
    focusMin: state === "Strong" ? 150 : state === "Solid" ? 90 : state === "Light" ? 40 : 0,
    hasNote: i % 3 === 0,
  };
}

const monthDays: CalendarDay[] = dateRange(`${MONTH}-01`, `${MONTH}-31`).map((d, i) =>
  d < TODAY ? day(d, PATTERN[i] ?? "Solid", i) : d === TODAY ? day(d, "Today", i) : day(d, "Future", i),
);

const weekDays = monthDays.filter((d) => d.date >= "2026-10-19" && d.date <= "2026-10-25");

const screen14: SeriesPoint[] = dateRange(addDays(TODAY, -13), TODAY).map((d, i) => ({ date: d, value: i === 6 ? null : 70 + ((i * 53) % 170) }));
const scores30: SeriesPoint[] = dateRange(addDays(TODAY, -29), TODAY).map((d, i) => ({ date: d, value: i % 7 === 3 ? null : 40 + ((i * 29) % 55) }));
const avg7: SeriesPoint[] = scores30.map((p, i) => {
  const win = scores30.slice(Math.max(0, i - 6), i + 1).flatMap((x) => (x.value == null ? [] : [x.value]));
  return { date: p.date, value: win.length ? Math.round(win.reduce((a, b) => a + b, 0) / win.length) : null };
});

const box = (b: Omit<MetricBox, "unit" | "target"> & Partial<Pick<MetricBox, "unit" | "target">>): MetricBox => ({ unit: "", target: null, ...b });

export const DESIGN_SAMPLES = {
  today: TODAY,
  month: MONTH,
  monthDays,
  weekDays,
  weekSummary: "Mon and Wed were Strong. The Minimum saved Tue.",
  screen14,
  scores30,
  avg7,
  weekMarks: ["Solid", "Strong", "Light", "Missed", "Solid", "Strong", "Future", "Future", "Future", "Future", "Future", "Future"] as WeekMark[],
  cycle: { pct: 83, word: "On track" },
  boxes: [
    box({ key: "today_score", label: "Today's score", value: null, delta: null, target: 100, progress: null, context: "Shown after shutdown" }),
    box({ key: "days_shown_up", label: "Days shown up", value: 10, delta: null, target: 11, progress: 91, context: "of 84 days in Cycle 1" }),
    box({ key: "avg_7d", label: "7-day average", value: 68, delta: 6, target: 80, progress: 85, context: "+6 vs the 7 days before" }),
    box({ key: "p1_hit_rate", label: "P1 hit rate", value: 74, unit: "%", delta: -3, target: 100, progress: 74, context: "Minimum counted on 6 days" }),
  ],
  areas: [
    { key: "career", label: "Career", color: "sage", minutes: 170 },
    { key: "japanese", label: "Japanese", color: "butter", minutes: 80 },
    { key: "health", label: "Health", color: "rose", minutes: 60 },
    { key: "freelance", label: "Freelance", color: "sky", minutes: 30 },
  ] as const,
  stuck: { uncertainty: 3, fear: 1, inertia: 4 },
  habitGrid: {
    dates: dateRange(addDays(TODAY, -27), TODAY),
    rows: [
      { habitId: "h1", behaviour: "Kana 10 min", cells: dateRange(addDays(TODAY, -27), TODAY).map((_, i) => (i % 9 === 4 ? "rest" : i % 4 === 1 ? "not" : "done")), pct: 72 },
      { habitId: "h2", behaviour: "Walk after lunch", cells: dateRange(addDays(TODAY, -27), TODAY).map((_, i) => (i % 9 === 4 ? "rest" : i % 3 === 0 ? "not" : "done")), pct: 64 },
      { habitId: "h3", behaviour: "Read 10 pages", cells: dateRange(addDays(TODAY, -27), TODAY).map((_, i) => (i % 9 === 4 ? "rest" : i % 2 === 0 ? "done" : "not")), pct: 50 },
    ],
  } satisfies HabitGrid,
  goals: [
    { name: "AWS SAA exam ready", pct: 62, color: "sage" },
    { name: "JLPT N5 vocabulary", pct: 40, color: "butter" },
    { name: "Run 5 km", pct: 25, color: "rose" },
  ] as const,
  capacity: { plannedMin: 260, freeMin: 300 },
} as const;
