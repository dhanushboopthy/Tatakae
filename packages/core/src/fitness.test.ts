import { describe, expect, it } from "vitest";
import {
  activePhaseOn,
  balanceKg,
  bestByExercise,
  bestLifts,
  kgText,
  lastSets,
  lastTimeText,
  mealForTime,
  MUSCLE_GROUPS,
  bodyAverages,
  maintenanceRuns,
  phaseProgress,
  rateToKcalPerDay,
  targetsOn,
  dailyTargets,
  dayTotals,
  e1rm,
  foodSnapshot,
  maintenanceFor,
  MICRO_INFO,
  MICRO_KEYS,
  monthSummary,
  PHASE_DEFAULTS,
  phaseLabel,
  phaseWeek,
  recentFoodIds,
  remaining,
  searchFoods,
  trendNow,
  trendOn,
  trendWeight,
  weeklyCheckIn,
  weeklyRatePct,
  weeklySetsByMuscle,
  weekSummary,
  type FoodLogRow,
} from "./fitness";
import {
  bodyLogRow, fitnessPhaseRow, foodLogRow, foodRow, maintenanceWeekRow, microsSchema, settingValueSchemas,
  workoutSetRow,
} from "./schemas";
import { DEFAULT_SETTINGS, readSettings } from "./settings";

const META = { updatedAt: "2026-10-14T00:00:00.000Z", deletedAt: null };

describe("trendWeight (EMA α = 0.1)", () => {
  it("starts at the first weigh-in and smooths the next ones", () => {
    const t = trendWeight([
      { date: "2026-10-01", weightKg: 100 },
      { date: "2026-10-02", weightKg: 101 },
    ]);
    expect(t.map((p) => p.trendKg)).toEqual([100, 100.1]);
  });

  it("carries the trend over days without a weigh-in", () => {
    const t = trendWeight([
      { date: "2026-10-01", weightKg: 100 },
      { date: "2026-10-02", weightKg: 101 },
      { date: "2026-10-05", weightKg: 99 },
    ]);
    expect(t.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(t[2]!.trendKg).toBeCloseTo(100.1, 10);
    expect(t[3]!.trendKg).toBeCloseTo(100.1, 10);
    expect(t[3]!.weightKg).toBeNull();
    expect(t[4]!.trendKg).toBeCloseTo(100.1 + 0.1 * (99 - 100.1), 10);
  });

  it("ignores rows without a weight and soft-deleted rows; the last log of a date wins", () => {
    const t = trendWeight([
      { date: "2026-10-01", weightKg: null },
      { date: "2026-10-02", weightKg: 90 },
      { date: "2026-10-03", weightKg: 200, deletedAt: "2026-10-04T00:00:00.000Z" },
      { date: "2026-10-04", weightKg: 91 },
    ]);
    expect(t.map((p) => p.date)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(t[2]!.trendKg).toBeCloseTo(90.1, 10);
  });

  it("extends to `through` when it is later than the last weigh-in", () => {
    const t = trendWeight([{ date: "2026-10-01", weightKg: 80 }], "2026-10-03");
    expect(t.map((p) => p.trendKg)).toEqual([80, 80, 80]);
  });

  it("returns nothing without weigh-ins", () => {
    expect(trendWeight([])).toEqual([]);
    expect(trendWeight([{ date: "2026-10-01", weightKg: null }])).toEqual([]);
  });

  it("trendOn picks the latest point at or before the date", () => {
    const t = trendWeight([{ date: "2026-10-02", weightKg: 80 }, { date: "2026-10-04", weightKg: 82 }]);
    expect(trendOn(t, "2026-10-01")).toBeNull();
    expect(trendOn(t, "2026-10-03")).toBe(80);
    expect(trendOn(t, "2026-12-01")).toBeCloseTo(80.2, 10);
  });
});

describe("weeklyRatePct", () => {
  const flat = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, weightKg: 100 }));

  it.each([
    ["flat then a 10 kg drop on day 8 → trend −1 kg of 100", [...flat, { date: "2026-10-08", weightKg: 90 }], "2026-10-08", -1],
    ["flat all week", [...flat, { date: "2026-10-08", weightKg: 100 }], "2026-10-08", 0],
    ["fewer than 7 days of history", flat, "2026-10-07", null],
    ["before any weigh-in", flat, "2026-09-30", null],
  ])("%s", (_name, logs, date, expected) => {
    const r = weeklyRatePct(trendWeight(logs), date);
    if (expected === null) expect(r).toBeNull();
    else expect(r).toBeCloseTo(expected, 10);
  });
});

describe("maintenanceFor", () => {
  const weeks = [
    { isoWeek: "2026-W40", kcal: 2700 },
    { isoWeek: "2026-W42", kcal: 2900 },
    { isoWeek: "2026-W52", kcal: 3000 },
    { isoWeek: "2026-W41", kcal: 9999, deletedAt: "2026-10-10T00:00:00.000Z" },
  ];

  it.each([
    ["set for this week (Wed of W42)", "2026-10-14", { kcal: 2900, setForThisWeek: true, fromWeek: "2026-W42" }],
    ["first day of a set week (Mon W40)", "2026-09-28", { kcal: 2700, setForThisWeek: true, fromWeek: "2026-W40" }],
    ["last day of a set week (Sun W42)", "2026-10-18", { kcal: 2900, setForThisWeek: true, fromWeek: "2026-W42" }],
    ["carried forward over a deleted week (W41)", "2026-10-07", { kcal: 2700, setForThisWeek: false, fromWeek: "2026-W40" }],
    ["carried forward several weeks (W45)", "2026-11-05", { kcal: 2900, setForThisWeek: false, fromWeek: "2026-W42" }],
    ["before every set week → default", "2026-09-21", { kcal: 2800, setForThisWeek: false, fromWeek: null }],
    ["ISO year boundary: 2027-01-01 is 2026-W53", "2027-01-01", { kcal: 3000, setForThisWeek: false, fromWeek: "2026-W52" }],
    ["next ISO year", "2027-02-01", { kcal: 3000, setForThisWeek: false, fromWeek: "2026-W52" }],
  ])("%s", (_name, date, expected) => {
    expect(maintenanceFor(weeks, date)).toEqual(expected);
  });

  it("uses the supplied default and the 2800 default when there are no weeks", () => {
    expect(maintenanceFor([], "2026-10-14")).toEqual({ kcal: 2800, setForThisWeek: false, fromWeek: null });
    expect(maintenanceFor([], "2026-10-14", 2500).kcal).toBe(2500);
  });
});

describe("dailyTargets", () => {
  const cut = PHASE_DEFAULTS.cut;
  const bulk = PHASE_DEFAULTS.bulk;
  const recomp = PHASE_DEFAULTS.recomp;

  it.each([
    {
      name: "cut 80 kg: −1 %/wk = 880 kcal deficit, within the limit",
      phase: { kind: "cut" as const, ...cut }, maintenance: 2800, trendKg: 80,
      kcal: 1920, proteinG: 176, fatG: 64, carbsG: 160, capped: false, rate: -1,
    },
    {
      name: "cut 95 kg: 1045 kcal deficit is capped at 1000, rate ≈ −0.96 %/wk",
      phase: { kind: "cut" as const, ...cut }, maintenance: 2800, trendKg: 95,
      kcal: 1800, proteinG: 209, fatG: 76, carbsG: 70, capped: true, rate: -0.957,
    },
    {
      name: "cut with maintenance 2200: the 1500 kcal floor limits the deficit to 700",
      phase: { kind: "cut" as const, ...cut }, maintenance: 2200, trendKg: 90,
      kcal: 1500, proteinG: 198, fatG: 72, carbsG: 15, capped: true, rate: -0.707,
    },
    {
      name: "cut with maintenance already below the floor: no deficit at all",
      phase: { kind: "cut" as const, ...cut }, maintenance: 1400, trendKg: 70,
      kcal: 1400, proteinG: 154, fatG: 56, carbsG: 70, capped: true, rate: 0,
    },
    {
      name: "cut where protein + fat already use the whole target: carbs never go negative",
      phase: { kind: "cut" as const, ...cut }, maintenance: 1500, trendKg: 100,
      kcal: 1500, proteinG: 220, fatG: 80, carbsG: 0, capped: true, rate: 0,
    },
    {
      name: "cut at exactly the 1000 kcal limit is not 'capped'",
      phase: { kind: "cut" as const, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8 }, maintenance: 2800, trendKg: 90.909090909,
      kcal: 1800, proteinG: 200, fatG: 73, carbsG: 86, capped: false, rate: -1,
    },
    {
      name: "cut with a 0 % rate holds maintenance",
      phase: { kind: "cut" as const, ratePctPerWeek: 0, proteinGPerKg: 2.2, fatGPerKg: 0.8 }, maintenance: 2800, trendKg: 80,
      kcal: 2800, proteinG: 176, fatG: 64, carbsG: 380, capped: false, rate: 0,
    },
    {
      name: "a positive rate on a cut is still a deficit",
      phase: { kind: "cut" as const, ratePctPerWeek: 1, proteinGPerKg: 2.2, fatGPerKg: 0.8 }, maintenance: 2800, trendKg: 80,
      kcal: 1920, proteinG: 176, fatG: 64, carbsG: 160, capped: false, rate: -1,
    },
    {
      name: "bulk 80 kg: +0.25 %/wk = 220 kcal surplus",
      phase: { kind: "bulk" as const, ...bulk }, maintenance: 2800, trendKg: 80,
      kcal: 3020, proteinG: 176, fatG: 64, carbsG: 435, capped: false, rate: 0.25,
    },
    {
      name: "recomp holds maintenance whatever the rate says",
      phase: { kind: "recomp" as const, ...recomp }, maintenance: 2800, trendKg: 80,
      kcal: 2800, proteinG: 176, fatG: 64, carbsG: 380, capped: false, rate: 0,
    },
    {
      name: "custom macros per kg (protein 2.0, fat 1.0)",
      phase: { kind: "recomp" as const, ratePctPerWeek: 0, proteinGPerKg: 2, fatGPerKg: 1 }, maintenance: 2500, trendKg: 75,
      kcal: 2500, proteinG: 150, fatG: 75, carbsG: 306, capped: false, rate: 0,
    },
  ])("$name", ({ phase, maintenance, trendKg, kcal, proteinG, fatG, carbsG, capped, rate }) => {
    const t = dailyTargets({ phase, maintenance, trendKg });
    expect(t).toMatchObject({ kcal, proteinG, fatG, carbsG, capped });
    expect(t.expectedRatePct).toBeCloseTo(rate, 2);
  });

  it("fibre target defaults to 30 g and can be set", () => {
    const input = { phase: { kind: "recomp" as const, ...recomp }, maintenance: 2800, trendKg: 80 };
    expect(dailyTargets(input).fibreG).toBe(30);
    expect(dailyTargets({ ...input, fibreTargetG: 38 }).fibreG).toBe(38);
  });

  it("phase defaults are cut −1, bulk +0.25, recomp 0 with protein 2.2 and fat 0.8 g/kg", () => {
    expect(PHASE_DEFAULTS.cut.ratePctPerWeek).toBe(-1);
    expect(PHASE_DEFAULTS.bulk.ratePctPerWeek).toBe(0.25);
    expect(PHASE_DEFAULTS.recomp.ratePctPerWeek).toBe(0);
    for (const k of ["cut", "bulk", "recomp"] as const) {
      expect(PHASE_DEFAULTS[k].proteinGPerKg).toBe(2.2);
      expect(PHASE_DEFAULTS[k].fatGPerKg).toBe(0.8);
    }
  });
});

// ---------- food totals and summaries ----------
function food(date: string, kcal: number, proteinG: number, extra: Partial<FoodLogRow> = {}): FoodLogRow {
  return { date, servings: 1, kcal, proteinG, carbsG: 0, fatG: 0, fibreG: null, micros: {}, ...extra };
}

describe("dayTotals", () => {
  it("sums nutrients × servings, uses fibreG then micros.fibre, skips deleted rows and other dates", () => {
    const logs: FoodLogRow[] = [
      { date: "2026-10-14", servings: 2, kcal: 100, proteinG: 10, carbsG: 5, fatG: 2, fibreG: 1.5, micros: { iron: 1, vitC: 10 } },
      { date: "2026-10-14", servings: 1, kcal: 250, proteinG: 20, carbsG: 30, fatG: 8, fibreG: null, micros: { fibre: 3, iron: 0.5 } },
      { date: "2026-10-14", servings: 1, kcal: 999, proteinG: 99, carbsG: 99, fatG: 99, fibreG: 9, micros: {}, deletedAt: "2026-10-14T10:00:00.000Z" },
      { date: "2026-10-13", servings: 1, kcal: 500, proteinG: 50, carbsG: 50, fatG: 50, fibreG: 5, micros: {} },
    ];
    expect(dayTotals(logs, "2026-10-14")).toEqual({
      kcal: 450, proteinG: 40, carbsG: 40, fatG: 12, fibreG: 6, micros: { iron: 2.5, vitC: 20 }, entries: 2,
    });
  });

  it("is all zeros for no logs", () => {
    expect(dayTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0, micros: {}, entries: 0 });
  });

  it("handles fractional servings", () => {
    expect(dayTotals([food("2026-10-14", 300, 25, { servings: 1.5 })])).toMatchObject({ kcal: 450, proteinG: 37.5 });
  });
});

describe("weekSummary", () => {
  // 2026-W42 = Mon 12 Oct … Sun 18 Oct. Trend from a 100 kg weigh-in on Sun 11 Oct then 99 kg every day:
  // trend(n days after the 11th) = 99 + 0.9ⁿ.
  const body = [
    { date: "2026-10-11", weightKg: 100 },
    ...Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${12 + i}`, weightKg: 99 })),
  ];
  const input = {
    foodLogs: [food("2026-10-12", 2000, 150), food("2026-10-13", 1800, 140)],
    bodyLogs: body,
    maintenanceWeeks: [{ isoWeek: "2026-W42", kcal: 2800 }],
    today: "2026-10-18",
  };

  it("averages, balance, weight change and the check-in sentence for a finished week", () => {
    const s = weekSummary("2026-W42", input);
    expect(s).toMatchObject({
      isoWeek: "2026-W42", start: "2026-10-12", end: "2026-10-18", daysLogged: 2,
      avgKcal: 1900, avgProteinG: 145, balanceKcal: -1800, maintenanceKcal: 2800,
      maintenanceSetForWeek: true, maintenanceFromWeek: "2026-W42",
      weightChangeKg: -0.52, ratePctPerWeek: -0.52,
    });
    expect(s.days).toHaveLength(7);
    expect(s.days[0]).toEqual({ date: "2026-10-12", kcal: 2000, proteinG: 150, maintenanceKcal: 2800 });
    expect(s.days[2]).toEqual({ date: "2026-10-14", kcal: null, proteinG: null, maintenanceKcal: 2800 });
    expect(weeklyCheckIn(s, -1)).toBe("Avg 1900 kcal vs 2800 maintenance, −1800 kcal for the week. Lost 0.5 %, goal 1 %.");
  });

  it("scales a part-way week to a per-week rate and leaves future days unlogged", () => {
    const s = weekSummary("2026-W42", { ...input, today: "2026-10-14" });
    // trend on the 14th = 99.729, 3 days after 100 → −0.271 % over 3 days → −0.632 %/week
    expect(s.weightChangeKg).toBe(-0.27);
    expect(s.ratePctPerWeek).toBe(-0.63);
    expect(s.days.slice(3).every((d) => d.kcal === null)).toBe(true);
  });

  it("carries last week's maintenance forward and says so", () => {
    const s = weekSummary("2026-W42", { ...input, maintenanceWeeks: [{ isoWeek: "2026-W41", kcal: 2900 }] });
    expect(s).toMatchObject({ maintenanceKcal: 2900, maintenanceSetForWeek: false, maintenanceFromWeek: "2026-W41", balanceKcal: -2000 });
  });

  it("falls back to the default maintenance when no week is set", () => {
    expect(weekSummary("2026-W42", { ...input, maintenanceWeeks: [] }).maintenanceKcal).toBe(2800);
    expect(weekSummary("2026-W42", { ...input, maintenanceWeeks: [], defaultMaintenance: 2500 }).maintenanceKcal).toBe(2500);
  });

  it("an empty week has no averages, no weight change and a plain check-in", () => {
    const s = weekSummary("2026-W42", { foodLogs: [], bodyLogs: [], maintenanceWeeks: [], today: "2026-10-18" });
    expect(s).toMatchObject({ daysLogged: 0, avgKcal: null, avgProteinG: null, balanceKcal: 0, weightChangeKg: null, ratePctPerWeek: null });
    expect(weeklyCheckIn(s, -1)).toBe("No food logged this week.");
  });

  it("weight change needs a trend before the week or two points inside it", () => {
    const one = weekSummary("2026-W42", { ...input, bodyLogs: [{ date: "2026-10-13", weightKg: 99 }] });
    expect(one.weightChangeKg).toBeNull();
    const two = weekSummary("2026-W42", { ...input, bodyLogs: [{ date: "2026-10-13", weightKg: 100 }, { date: "2026-10-15", weightKg: 90 }] });
    expect(two.weightChangeKg).toBeCloseTo(-1, 10); // trend 100 → 99 over 2 days (carry-forward day in between)
  });

  it("ignores deleted food logs", () => {
    const s = weekSummary("2026-W42", { ...input, foodLogs: [...input.foodLogs, food("2026-10-15", 5000, 1, { deletedAt: "2026-10-15T12:00:00.000Z" })] });
    expect(s.daysLogged).toBe(2);
  });

  it("throws on a malformed week", () => {
    expect(() => weekSummary("2026-W54", input)).toThrow();
    expect(() => weekSummary("nope", input)).toThrow();
  });
});

describe("monthSummary", () => {
  const maintenanceWeeks = [
    { isoWeek: "2026-W41", kcal: 3000 },
    { isoWeek: "2026-W42", kcal: 2800 },
  ];
  const input = {
    foodLogs: [food("2026-10-06", 2500, 120), food("2026-10-13", 2000, 160)],
    bodyLogs: [{ date: "2026-10-01", weightKg: 90 }, { date: "2026-10-31", weightKg: 90 }],
    maintenanceWeeks,
    today: "2026-10-31",
  };

  it("uses each day's own week maintenance for the balance", () => {
    const m = monthSummary("2026-10", input);
    expect(m).toMatchObject({ month: "2026-10", start: "2026-10-01", end: "2026-10-31", daysLogged: 2, avgKcal: 2250, avgProteinG: 140, balanceKcal: -500 - 800 });
    expect(m.days).toHaveLength(31);
  });

  it("lists one row per ISO week touching the month, clipped to its days", () => {
    const m = monthSummary("2026-10", input);
    expect(m.weeks.map((w) => [w.isoWeek, w.start, w.end])).toEqual([
      ["2026-W40", "2026-10-01", "2026-10-04"],
      ["2026-W41", "2026-10-05", "2026-10-11"],
      ["2026-W42", "2026-10-12", "2026-10-18"],
      ["2026-W43", "2026-10-19", "2026-10-25"],
      ["2026-W44", "2026-10-26", "2026-10-31"],
    ]);
    expect(m.weeks[1]).toMatchObject({ daysLogged: 1, balanceKcal: -500, maintenanceKcal: 3000, maintenanceSetForWeek: true });
    expect(m.weeks[2]).toMatchObject({ daysLogged: 1, balanceKcal: -800, maintenanceKcal: 2800 });
    expect(m.weeks[3]).toMatchObject({ daysLogged: 0, maintenanceSetForWeek: false, maintenanceFromWeek: "2026-W42" });
  });

  it("a steady weight gives a zero change", () => {
    const m = monthSummary("2026-10", input);
    expect(m.weightChangeKg).toBe(0);
    expect(m.ratePctPerWeek).toBe(0);
  });

  it("handles February and a month with no data", () => {
    const m = monthSummary("2027-02", { foodLogs: [], bodyLogs: [], maintenanceWeeks: [], today: "2027-02-28" });
    expect(m.days).toHaveLength(28);
    expect(m.avgKcal).toBeNull();
    expect(m.weeks[0]).toMatchObject({ isoWeek: "2027-W05", start: "2027-02-01" });
    expect(m.weeks.at(-1)).toMatchObject({ end: "2027-02-28" });
  });

  it("throws on a malformed month", () => {
    expect(() => monthSummary("2026-13", input)).toThrow();
  });
});

describe("weeklyCheckIn", () => {
  const base = { daysLogged: 5, avgKcal: 3100, maintenanceKcal: 2800, balanceKcal: 1500, ratePctPerWeek: 0.3 };

  it.each([
    ["surplus and a gain against a bulk goal", base, 0.25, "Avg 3100 kcal vs 2800 maintenance, +1500 kcal for the week. Gained 0.3 %, goal 0.25 %."],
    ["on maintenance, held steady, recomp has no goal", { ...base, avgKcal: 2800, balanceKcal: 0, ratePctPerWeek: 0.02 }, 0, "Avg 2800 kcal vs 2800 maintenance, 0 kcal for the week. Held steady."],
    ["deficit with no weight data", { ...base, avgKcal: 1910, balanceKcal: -6230, ratePctPerWeek: null }, -1, "Avg 1910 kcal vs 2800 maintenance, −6230 kcal for the week."],
    ["the example from the plan", { ...base, avgKcal: 1910, balanceKcal: -6230, ratePctPerWeek: -0.6 }, -1, "Avg 1910 kcal vs 2800 maintenance, −6230 kcal for the week. Lost 0.6 %, goal 1 %."],
    ["no goal given", { ...base, avgKcal: 2000, balanceKcal: -800, ratePctPerWeek: -0.4 }, undefined, "Avg 2000 kcal vs 2800 maintenance, −800 kcal for the week. Lost 0.4 %."],
  ])("%s", (_name, summary, goal, expected) => {
    expect(weeklyCheckIn(summary, goal)).toBe(expected);
  });
});

// ---------- training ----------
describe("e1rm (Epley)", () => {
  it.each([
    [100, 1, 100],
    [100, 5, 116.7],
    [80, 10, 106.7],
    [60, 3, 66],
    [0, 5, 0],
    [100, 0, 0],
    [-20, 5, 0],
  ])("%s kg × %s → %s", (kg, reps, expected) => {
    expect(e1rm(kg, reps)).toBe(expected);
  });
});

describe("weeklySetsByMuscle", () => {
  const workouts = [
    { id: "w1", date: "2026-10-13" },
    { id: "w2", date: "2026-10-20" },
    { id: "w3", date: "2026-10-14", deletedAt: "2026-10-14T12:00:00.000Z" },
  ];
  const set = (workoutId: string, muscle: string, extra = {}) => ({ workoutId, exercise: "x", muscle, reps: 8, kg: 50, ...extra });
  const sets = [
    set("w1", "chest"), set("w1", "chest"), set("w1", "chest"), set("w1", "back"), set("w1", "back"),
    set("w2", "chest"), set("w3", "legs"), set("w1", "legs", { deletedAt: "2026-10-13T12:00:00.000Z" }),
  ];

  it.each([
    ["2026-W42", [{ muscle: "chest", sets: 3 }, { muscle: "back", sets: 2 }]],
    ["2026-W43", [{ muscle: "chest", sets: 1 }]],
    ["2026-W41", []],
  ])("%s", (week, expected) => {
    expect(weeklySetsByMuscle(workouts, sets, week)).toEqual(expected);
  });

  it("breaks ties by muscle name and rejects a bad week", () => {
    const tie = [set("w1", "shoulders"), set("w1", "biceps")];
    expect(weeklySetsByMuscle(workouts, tie, "2026-W42").map((r) => r.muscle)).toEqual(["biceps", "shoulders"]);
    expect(() => weeklySetsByMuscle(workouts, sets, "bad")).toThrow();
  });
});

describe("bestByExercise", () => {
  it("keeps the set with the highest e1RM per exercise, ignoring deleted sets, sorted by name", () => {
    const s = (exercise: string, kg: number, reps: number, extra = {}) => ({ workoutId: "w", exercise, muscle: "chest", kg, reps, ...extra });
    expect(
      bestByExercise([
        s("Squat", 100, 1), s("Bench", 80, 5), s("Bench", 85, 3), s("Bench", 70, 10),
        s("Bench", 200, 5, { deletedAt: "2026-10-14T00:00:00.000Z" }), s("Row", 0, 10),
      ]),
    ).toEqual([
      { exercise: "Bench", muscle: "chest", e1rm: 93.5, kg: 85, reps: 3 },
      { exercise: "Squat", muscle: "chest", e1rm: 100, kg: 100, reps: 1 },
    ]);
  });
});

describe("kgText / lastTimeText", () => {
  it.each([[80, "80"], [82.5, "82.5"], [0, "0"], [12.345, "12.35"]])("kgText(%s) = %s", (kg, text) => {
    expect(kgText(kg)).toBe(text);
  });
  it.each([
    [[{ kg: 80, reps: 6 }, { kg: 80, reps: 6 }, { kg: 80, reps: 6 }, { kg: 80, reps: 5 }], "80 × 6, 6, 6, 5"],
    [[{ kg: 80, reps: 6 }, { kg: 85, reps: 4 }, { kg: 85, reps: 3 }, { kg: 80, reps: 8 }], "80 × 6 · 85 × 4, 3 · 80 × 8"],
    [[{ kg: 26, reps: 10 }], "26 × 10"],
    [[], ""],
  ])("lastTimeText %j", (sets, expected) => {
    expect(lastTimeText(sets)).toBe(expected);
  });
});

describe("mealForTime", () => {
  it.each([
    ["00:00", "breakfast"], ["06:30", "breakfast"], ["10:59", "breakfast"], ["11:00", "lunch"], ["14:59", "lunch"],
    ["15:00", "snack"], ["17:59", "snack"], ["18:00", "dinner"], ["23:30", "dinner"],
  ])("%s → %s", (time, slot) => {
    expect(mealForTime(time)).toBe(slot);
  });
});

describe("lastSets / bestLifts", () => {
  const workouts = [
    { id: "w1", date: "2026-10-01" },
    { id: "w2", date: "2026-10-08" },
    { id: "w3", date: "2026-10-14" },
    { id: "wx", date: "2026-10-10", deletedAt: "2026-10-10T20:00:00.000Z" },
  ];
  const s = (workoutId: string, exercise: string, kg: number, reps: number, order: number, extra = {}) => ({
    id: `${workoutId}-${exercise}-${order}`, workoutId, exercise, muscle: "Chest", kg, reps, order, ...extra,
  });
  const sets = [
    s("w1", "Bench", 75, 8, 0), s("w1", "Bench", 75, 7, 1),
    s("w2", "Bench", 80, 6, 1), s("w2", "Bench", 80, 6, 0), s("w2", "Bench", 80, 5, 2), s("w2", "Squat", 100, 5, 3),
    s("w3", "Bench", 82.5, 5, 0),
    s("wx", "Bench", 200, 5, 0), // belongs to a deleted session
    s("w2", "Bench", 300, 1, 4, { deletedAt: "2026-10-08T20:00:00.000Z" }),
  ];

  it("lastSets: the most recent earlier session of the exercise, in the order done", () => {
    expect(lastSets("Bench", workouts, sets, "2026-10-14").map((x) => `${x.kg}×${x.reps}`)).toEqual(["80×6", "80×6", "80×5"]);
    expect(lastSets("Bench", workouts, sets, "2026-10-08").map((x) => `${x.kg}×${x.reps}`)).toEqual(["75×8", "75×7"]);
    expect(lastSets("Bench", workouts, sets, "2026-10-01")).toEqual([]);
    expect(lastSets("Squat", workouts, sets, "2026-10-14")).toHaveLength(1);
    expect(lastSets("Curl", workouts, sets, "2026-10-14")).toEqual([]);
  });

  it("bestLifts: best e1RM now and the change since a date, ignoring deleted sessions and sets", () => {
    const lifts = bestLifts(workouts, sets, "2026-10-08");
    expect(lifts.map((l) => l.exercise)).toEqual(["Bench", "Squat"]);
    // Bench: now 82.5×5 = 96.3; before 8 Oct: 75×8 = 95
    expect(lifts[0]).toMatchObject({ exercise: "Bench", e1rm: 96.3, kg: 82.5, reps: 5, previousE1rm: 95, delta: 1.3 });
    expect(lifts[1]).toMatchObject({ exercise: "Squat", e1rm: 116.7, previousE1rm: null, delta: null });
  });

  it("MUSCLE_GROUPS has the groups the Training tab offers", () => {
    expect(MUSCLE_GROUPS).toContain("Chest");
    expect(new Set(MUSCLE_GROUPS).size).toBe(MUSCLE_GROUPS.length);
  });
});

// ---------- constants and schemas ----------
describe("MICRO_KEYS", () => {
  it("lists the plan's 13 micronutrients, each with a label and unit defined once", () => {
    expect(MICRO_KEYS).toHaveLength(13);
    for (const k of MICRO_KEYS) expect(MICRO_INFO[k]).toMatchObject({ label: expect.any(String), unit: expect.stringMatching(/^(g|mg|µg)$/) });
  });
});

describe("fitness schemas", () => {
  it("microsSchema takes any subset of MICRO_KEYS and rejects unknown keys and negatives", () => {
    expect(microsSchema.safeParse({}).success).toBe(true);
    expect(microsSchema.safeParse({ iron: 2, vitD: 5 }).success).toBe(true);
    expect(microsSchema.safeParse({ iron: -1 }).success).toBe(false);
    expect(microsSchema.safeParse({ caffeine: 1 }).success).toBe(false);
  });

  it("maintenance_weeks: ISO week key and kcal range", () => {
    const row = { id: "m1", isoWeek: "2026-W42", kcal: 2800, note: null, ...META };
    expect(maintenanceWeekRow.safeParse(row).success).toBe(true);
    expect(maintenanceWeekRow.safeParse({ ...row, isoWeek: "2026-W54" }).success).toBe(false);
    expect(maintenanceWeekRow.safeParse({ ...row, isoWeek: "2026-42" }).success).toBe(false);
    expect(maintenanceWeekRow.safeParse({ ...row, kcal: 100 }).success).toBe(false);
  });

  it("body_logs, foods, food_logs, fitness_phases and workout_sets accept a valid row and reject a bad one", () => {
    expect(bodyLogRow.safeParse({ id: "b1", date: "2026-10-14", weightKg: 82.4, steps: 9000, waterMl: 2500, sleepMin: 440, note: null, ...META }).success).toBe(true);
    expect(bodyLogRow.safeParse({ id: "b1", date: "2026-10-14", weightKg: 5, steps: null, waterMl: null, sleepMin: null, note: null, ...META }).success).toBe(false);
    const nutrients = { kcal: 180, proteinG: 24, carbsG: 3, fatG: 8, fibreG: null, micros: { iron: 1.2 } };
    expect(foodRow.safeParse({ id: "f1", name: "Paneer", servingLabel: "100 g", servingG: 100, favourite: false, ...nutrients, ...META }).success).toBe(true);
    expect(foodRow.safeParse({ id: "f1", name: "", servingLabel: "100 g", servingG: 100, favourite: false, ...nutrients, ...META }).success).toBe(false);
    expect(foodLogRow.safeParse({ id: "l1", date: "2026-10-14", meal: "lunch", foodId: "f1", name: "Paneer", servings: 1.5, ...nutrients, ...META }).success).toBe(true);
    expect(foodLogRow.safeParse({ id: "l1", date: "2026-10-14", meal: "brunch", foodId: null, name: "x", servings: 1, ...nutrients, ...META }).success).toBe(false);
    expect(fitnessPhaseRow.safeParse({ id: "p1", kind: "cut", startDate: "2026-10-14", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 95, note: null, ...META }).success).toBe(true);
    expect(fitnessPhaseRow.safeParse({ id: "p1", kind: "shred", startDate: "2026-10-14", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 95, note: null, ...META }).success).toBe(false);
    expect(workoutSetRow.safeParse({ id: "s1", workoutId: "w1", exercise: "Bench press", muscle: "chest", order: 0, reps: 5, kg: 80, rpe: 8, ...META }).success).toBe(true);
    expect(workoutSetRow.safeParse({ id: "s1", workoutId: "w1", exercise: "Bench press", muscle: "chest", order: 0, reps: 0, kg: 80, rpe: null, ...META }).success).toBe(false);
  });

  it("settings: fitness keys default to 2800 / 8000 / 3000 / 450 / 30 and validate", () => {
    expect([
      DEFAULT_SETTINGS["fitness.maintenanceKcal"], DEFAULT_SETTINGS["fitness.stepsTarget"], DEFAULT_SETTINGS["fitness.waterTargetMl"],
      DEFAULT_SETTINGS["fitness.sleepTargetMin"], DEFAULT_SETTINGS["fitness.fibreTargetG"],
    ]).toEqual([2800, 8000, 3000, 450, 30]);
    expect(settingValueSchemas["fitness.maintenanceKcal"].safeParse(2600).success).toBe(true);
    expect(settingValueSchemas["fitness.maintenanceKcal"].safeParse(2600.5).success).toBe(false);
    expect(readSettings([]) ["fitness.maintenanceKcal"]).toBe(2800);
    expect(readSettings([{ key: "fitness.maintenanceKcal", value: "2650", deletedAt: null }])["fitness.maintenanceKcal"]).toBe(2650);
    expect(readSettings([{ key: "fitness.maintenanceKcal", value: "\"x\"", deletedAt: null }])["fitness.maintenanceKcal"]).toBe(2800);
  });
});

// ---------- targets on a date, averages, phase progress, maintenance history ----------
describe("targetsOn", () => {
  const cut = { id: "c", kind: "cut" as const, startDate: "2026-09-01", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 90 };

  it("uses the phase, the trend weight and the carried-forward maintenance of that date", () => {
    const r = targetsOn("2026-10-14", { phases: [cut], bodyLogs: [{ date: "2026-10-01", weightKg: 85 }], maintenanceWeeks: [{ isoWeek: "2026-W41", kcal: 2750 }] });
    expect(r.phase?.id).toBe("c");
    expect(r.trendKg).toBe(85);
    expect(r.maintenance).toEqual({ kcal: 2750, setForThisWeek: false, fromWeek: "2026-W41" });
    expect(r.targets).toMatchObject({ kcal: 1815, proteinG: 187, capped: false });
  });

  it("falls back to the phase's start weight when nothing has been weighed", () => {
    const r = targetsOn("2026-10-14", { phases: [cut], bodyLogs: [], maintenanceWeeks: [{ isoWeek: "2026-W41", kcal: 2750 }] });
    expect(r.trendKg).toBe(90);
    expect(r.targets).toMatchObject({ kcal: 1760, capped: false });
  });

  it("no phase and no weight: no targets; no phase with a weight: recomp at the default maintenance", () => {
    expect(targetsOn("2026-10-14", { phases: [], bodyLogs: [], maintenanceWeeks: [] })).toMatchObject({ phase: null, trendKg: null, targets: null });
    expect(targetsOn("2026-10-14", { phases: [], bodyLogs: [{ date: "2026-10-10", weightKg: 80 }], maintenanceWeeks: [] }).targets).toMatchObject({ kcal: 2800, proteinG: 176, capped: false });
  });

  it("a phase that has not started yet does not apply", () => {
    expect(targetsOn("2026-08-31", { phases: [cut], bodyLogs: [], maintenanceWeeks: [] }).phase).toBeNull();
  });
});

describe("bodyAverages", () => {
  const logs = [
    { date: "2026-10-12", steps: 8000, waterMl: 2000, sleepMin: 420 },
    { date: "2026-10-13", steps: 7000, waterMl: null, sleepMin: 450 },
    { date: "2026-10-14", steps: null, waterMl: null, sleepMin: null },
    { date: "2026-10-15", steps: 100000, waterMl: 9000, sleepMin: 600, deletedAt: "2026-10-15T00:00:00.000Z" },
    { date: "2026-10-20", steps: 1, waterMl: 1, sleepMin: 1 },
  ];
  it("averages the days that have a value, in range, skipping deleted rows", () => {
    expect(bodyAverages(logs, "2026-10-12", "2026-10-18")).toEqual({ steps: 7500, waterMl: 2000, sleepMin: 435 });
  });
  it("is null with nothing in range", () => {
    expect(bodyAverages(logs, "2026-11-01", "2026-11-07")).toEqual({ steps: null, waterMl: null, sleepMin: null });
  });
});

describe("rateToKcalPerDay", () => {
  it.each([[84.4, 1, 928.4], [95, 1, 1045], [80, 0.25, 220], [80, 0, 0]])("%s kg at %s %%/wk → %s kcal", (kg, rate, kcal) => {
    expect(rateToKcalPerDay(kg, rate)).toBeCloseTo(kcal, 1);
  });
});

describe("balanceKg", () => {
  it.each([[-5710, -0.74], [7700, 1], [0, 0], [-7700, -1], [385, 0.05]])("%s kcal → %s kg", (kcal, kg) => {
    expect(balanceKg(kcal)).toBe(kg);
  });
});

describe("phaseProgress", () => {
  const cut = { kind: "cut" as const, startDate: "2026-09-01", ratePctPerWeek: -1, startWeightKg: 90 };

  it("weeks, change and the average rate against the goal", () => {
    expect(phaseProgress(cut, [{ date: "2026-09-01", weightKg: 85 }], "2026-10-14")).toEqual({
      weeks: 7, startKg: 90, trendKg: 85, changeKg: -5, changePct: -5.6, avgRatePct: -0.91, onPace: true,
    });
  });
  it("behind the goal is not on pace", () => {
    expect(phaseProgress(cut, [{ date: "2026-09-01", weightKg: 89 }], "2026-10-14")).toMatchObject({ avgRatePct: -0.18, onPace: false });
  });
  it("under a week of data has no average rate", () => {
    expect(phaseProgress(cut, [{ date: "2026-09-01", weightKg: 89 }], "2026-09-05")).toMatchObject({ weeks: 1, avgRatePct: null, onPace: null });
  });
  it("recomp has no pace; no weigh-ins leave the change empty", () => {
    expect(phaseProgress({ ...cut, kind: "recomp", ratePctPerWeek: 0 }, [{ date: "2026-09-01", weightKg: 90 }], "2026-10-14").onPace).toBeNull();
    expect(phaseProgress(cut, [], "2026-10-14")).toMatchObject({ trendKg: null, changeKg: null, changePct: null, avgRatePct: null, onPace: null });
  });
});

describe("maintenanceRuns", () => {
  it("merges consecutive weeks with the same value, newest first, carried weeks included", () => {
    const weeks = [
      { isoWeek: "2026-W36", kcal: 2800 },
      { isoWeek: "2026-W38", kcal: 2750 },
      { isoWeek: "2026-W41", kcal: 2750 },
    ];
    expect(maintenanceRuns(weeks, "2026-W42")).toEqual([
      { fromWeek: "2026-W38", toWeek: "2026-W42", kcal: 2750, setByHand: true },
      { fromWeek: "2026-W36", toWeek: "2026-W37", kcal: 2800, setByHand: true },
    ]);
  });
  it("runs across the ISO year boundary (2026 has 53 weeks)", () => {
    expect(maintenanceRuns([{ isoWeek: "2026-W52", kcal: 3000 }], "2027-W02")).toEqual([{ fromWeek: "2026-W52", toWeek: "2027-W02", kcal: 3000, setByHand: true }]);
  });
  it("is empty before the first value and ignores deleted weeks", () => {
    expect(maintenanceRuns([], "2026-W42")).toEqual([]);
    expect(maintenanceRuns([{ isoWeek: "2026-W43", kcal: 2800 }], "2026-W42")).toEqual([]);
    expect(maintenanceRuns([{ isoWeek: "2026-W40", kcal: 2800, deletedAt: "2026-10-01T00:00:00.000Z" }], "2026-W42")).toEqual([]);
  });
});

describe("period summary extras", () => {
  it("average fibre, weigh-in count and trend start/end", () => {
    const s = weekSummary("2026-W42", {
      foodLogs: [food("2026-10-12", 2000, 150, { fibreG: 20 }), food("2026-10-13", 1800, 140, { fibreG: 30 })],
      bodyLogs: [{ date: "2026-10-11", weightKg: 100 }, { date: "2026-10-12", weightKg: 99 }, { date: "2026-10-14", weightKg: 99 }],
      maintenanceWeeks: [],
      today: "2026-10-18",
    });
    expect(s.avgFibreG).toBe(25);
    expect(s.weighIns).toBe(2);
    expect(s.trendStartKg).toBe(100);
    expect(s.trendEndKg).toBe(99.8); // 100 → 99.9 on the 12th → 99.81 on the 14th, carried to the 18th
  });
  it("are empty with no data", () => {
    expect(weekSummary("2026-W42", { foodLogs: [], bodyLogs: [], maintenanceWeeks: [] })).toMatchObject({ avgFibreG: null, weighIns: 0, trendStartKg: null, trendEndKg: null });
  });
});

// ---------- phases, foods, day view ----------
describe("activePhaseOn / phaseWeek / phaseLabel", () => {
  const p = (id: string, kind: "cut" | "bulk" | "recomp", startDate: string, endDate: string | null, extra = {}) => ({
    id, kind, startDate, endDate, ratePctPerWeek: PHASE_DEFAULTS[kind].ratePctPerWeek, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 90, ...extra,
  });
  const phases = [p("a", "recomp", "2026-07-01", "2026-08-31"), p("b", "cut", "2026-09-01", null), p("c", "bulk", "2026-01-01", null, { deletedAt: "2026-01-02T00:00:00.000Z" })];

  it.each([
    ["2026-06-30", null],
    ["2026-07-01", "a"],
    ["2026-08-31", "a"],
    ["2026-09-01", "b"],
    ["2027-03-01", "b"],
  ])("%s → %s", (date, id) => {
    expect(activePhaseOn(phases, date)?.id ?? null).toBe(id);
  });

  it("the latest start wins when phases overlap", () => {
    expect(activePhaseOn([p("x", "cut", "2026-09-01", null), p("y", "bulk", "2026-10-01", null)], "2026-10-14")?.id).toBe("y");
  });

  it.each([
    ["2026-09-01", 1], ["2026-09-07", 1], ["2026-09-08", 2], ["2026-10-14", 7],
  ])("phase week on %s is %s", (date, week) => {
    expect(phaseWeek({ startDate: "2026-09-01" }, date)).toBe(week);
  });

  it("labels the phase", () => {
    expect(phaseLabel(p("b", "cut", "2026-09-01", null), "2026-10-14")).toBe("Cut · week 7 · −1 % a week");
    expect(phaseLabel(p("c", "bulk", "2026-09-01", null), "2026-09-02")).toBe("Bulk · week 1 · +0.25 % a week");
    expect(phaseLabel(p("a", "recomp", "2026-09-01", null), "2026-09-02")).toBe("Recomp · week 1 · at maintenance");
  });
});

describe("trendNow", () => {
  it("ignores weigh-ins after the date and is null before the first", () => {
    const logs = [{ date: "2026-10-10", weightKg: 80 }, { date: "2026-10-12", weightKg: 90 }];
    expect(trendNow(logs, "2026-10-09")).toBeNull();
    expect(trendNow(logs, "2026-10-11")).toBe(80);
    expect(trendNow(logs, "2026-10-12")).toBeCloseTo(81, 10);
  });
});

describe("foodSnapshot / searchFoods / recentFoodIds / remaining", () => {
  it("snapshot copies the nutrients and the micros object", () => {
    const f = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fibreG: null, micros: { iron: 1 } };
    const s = foodSnapshot(f);
    expect(s).toEqual(f);
    expect(s.micros).not.toBe(f.micros);
  });

  it("search matches every word, favourites first, skipping deleted foods", () => {
    const foods = [
      { name: "Paneer tikka", favourite: false },
      { name: "Paneer 100 g", favourite: true },
      { name: "Chapati", favourite: false },
      { name: "Paneer old", favourite: true, deletedAt: "2026-10-01T00:00:00.000Z" },
    ];
    expect(searchFoods(foods, "paneer").map((f) => f.name)).toEqual(["Paneer 100 g", "Paneer tikka"]);
    expect(searchFoods(foods, "tikka paneer").map((f) => f.name)).toEqual(["Paneer tikka"]);
    expect(searchFoods(foods, "").map((f) => f.name)).toEqual(["Paneer 100 g", "Chapati", "Paneer tikka"]);
    expect(searchFoods(foods, "xyz")).toEqual([]);
  });

  it("recent foods are unique, newest first, limited, without free-text entries", () => {
    const logs = [
      { id: "1", date: "2026-10-10", foodId: "a" },
      { id: "2", date: "2026-10-12", foodId: "b" },
      { id: "3", date: "2026-10-12", foodId: "a" },
      { id: "4", date: "2026-10-13", foodId: null },
      { id: "5", date: "2026-10-09", foodId: "c", deletedAt: "2026-10-09T00:00:00.000Z" },
      { id: "6", date: "2026-10-01", foodId: "d" },
    ];
    expect(recentFoodIds(logs)).toEqual(["a", "b", "d"]);
    expect(recentFoodIds(logs, 2)).toEqual(["a", "b"]);
  });

  it.each([
    [1240, 1820, { left: 580, pct: 68, over: false }],
    [1820, 1820, { left: 0, pct: 100, over: false }],
    [2000, 1820, { left: -180, pct: 110, over: true }],
    [0, 1820, { left: 1820, pct: 0, over: false }],
    [500, 0, { left: -500, pct: 0, over: true }],
  ])("remaining(%s, %s)", (eaten, target, expected) => {
    expect(remaining(eaten, target)).toEqual(expected);
  });
});
