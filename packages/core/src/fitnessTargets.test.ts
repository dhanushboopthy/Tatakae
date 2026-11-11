import { describe, expect, it } from "vitest";
import { checkPhaseStart, dailyTargets, targetsOn, type PhaseRow } from "./fitness";
import { bodyLogRow, settingValueSchemas } from "./schemas";
import { DEFAULT_SETTINGS, readSettings } from "./settings";
import { cycleFor, indexStats } from "./stats";

// Editable calories (standing target, one day) and editable start dates (fitness phase, Cycle 1).

const META = { updatedAt: "2026-10-14T00:00:00.000Z", deletedAt: null };
const phase = (over: Partial<PhaseRow> & { id: string; startDate: string }): PhaseRow => ({
  kind: "cut",
  endDate: null,
  ratePctPerWeek: -1,
  proteinGPerKg: 2.2,
  fatGPerKg: 0.8,
  startWeightKg: 80,
  ...over,
});
const weigh = (date: string, weightKg: number, kcalOverride: number | null = null) => ({ date, weightKg, kcalOverride });

describe("dailyTargets with typed-in calories", () => {
  const base = { phase: { kind: "cut" as const, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8 }, maintenance: 2800, trendKg: 80 };

  it("uses the typed kcal as is and keeps protein and fat per kg", () => {
    const auto = dailyTargets(base);
    const typed = dailyTargets({ ...base, kcalOverride: { kcal: 2400, source: "manual" } });
    expect(auto.source).toBe("auto");
    expect(typed).toMatchObject({ kcal: 2400, source: "manual", capped: false, proteinG: auto.proteinG, fatG: auto.fatG });
    // carbs fill whatever is left: (2400 − 176×4 − 64×9) / 4
    expect(typed.carbsG).toBe(Math.round((2400 - 176 * 4 - 64 * 9) / 4));
  });

  it("is not held to the cut limits (it is the user's choice) and reports the rate it gives", () => {
    const typed = dailyTargets({ ...base, kcalOverride: { kcal: 1200, source: "day" } });
    expect(typed.kcal).toBe(1200);
    expect(typed.capped).toBe(false);
    expect(typed.expectedRatePct).toBeLessThan(-1.5);
  });
});

describe("targetsOn precedence: day > standing > calculated", () => {
  const input = {
    phases: [phase({ id: "p1", startDate: "2026-10-01" })],
    bodyLogs: [weigh("2026-10-10", 80), weigh("2026-10-14", 80, 2100)],
    maintenanceWeeks: [],
  };

  it("calculated when nothing is typed in", () => {
    const t = targetsOn("2026-10-13", input).targets;
    expect(t?.source).toBe("auto");
  });

  it("the standing target applies from its date, not before", () => {
    const manualKcal = { kcal: 2300, from: "2026-10-12" };
    expect(targetsOn("2026-10-11", { ...input, manualKcal }).targets?.source).toBe("auto");
    expect(targetsOn("2026-10-12", { ...input, manualKcal }).targets).toMatchObject({ kcal: 2300, source: "manual" });
    expect(targetsOn("2026-10-20", { ...input, manualKcal }).targets).toMatchObject({ kcal: 2300, source: "manual" });
  });

  it("a day's own number beats the standing target, on that day only", () => {
    const manualKcal = { kcal: 2300, from: "2026-10-12" };
    expect(targetsOn("2026-10-14", { ...input, manualKcal }).targets).toMatchObject({ kcal: 2100, source: "day" });
    expect(targetsOn("2026-10-15", { ...input, manualKcal }).targets).toMatchObject({ kcal: 2300, source: "manual" });
  });

  it("ignores a deleted day override", () => {
    const bodyLogs = [{ ...weigh("2026-10-10", 80), deletedAt: null }, { ...weigh("2026-10-14", 80, 2100), deletedAt: "2026-10-14T01:00:00.000Z" }];
    expect(targetsOn("2026-10-14", { ...input, bodyLogs }).targets?.source).toBe("auto");
  });
});

describe("checkPhaseStart", () => {
  const first = phase({ id: "a", startDate: "2026-08-01", endDate: "2026-09-30", kind: "bulk" });
  const second = phase({ id: "b", startDate: "2026-10-01" });
  const phases = [first, second];
  const today = "2026-10-20";

  it("allows a start between the previous phase's start and today, and moves the previous end with it", () => {
    expect(checkPhaseStart(phases, second, "2026-10-05", today)).toEqual({ ok: true, prevEnd: { id: "a", endDate: "2026-10-04" } });
    expect(checkPhaseStart(phases, second, "2026-09-10", today)).toEqual({ ok: true, prevEnd: { id: "a", endDate: "2026-09-09" } });
  });

  it("refuses the future, and a start on or before the previous phase's start", () => {
    expect(checkPhaseStart(phases, second, "2026-10-21", today)).toEqual({ ok: false, reason: "future" });
    expect(checkPhaseStart(phases, second, "2026-08-01", today)).toEqual({ ok: false, reason: "before_previous" });
  });

  it("refuses a start after the phase's own end", () => {
    const ended = phase({ id: "b", startDate: "2026-10-01", endDate: "2026-10-10" });
    expect(checkPhaseStart([first, ended], ended, "2026-10-11", today)).toEqual({ ok: false, reason: "after_end" });
  });

  it("with no previous phase any date up to today is fine and nothing else moves", () => {
    expect(checkPhaseStart([second], second, "2026-01-01", today)).toEqual({ ok: true, prevEnd: null });
  });
});

describe("Cycle 1 start date", () => {
  it("cycleFor counts 84-day cycles from the given start", () => {
    expect(cycleFor("2026-11-20", "2026-11-09")).toEqual({ index: 1, start: "2026-11-09", end: "2027-01-31" });
    expect(cycleFor("2027-02-01", "2026-11-09")).toEqual({ index: 2, start: "2027-02-01", end: "2027-04-25" });
  });

  it("defaults to the original Cycle 1 and the stats index carries the start", () => {
    expect(cycleFor("2026-10-12").start).toBe("2026-10-12");
    expect(indexStats({ days: [], missions: [] } as never).cycleStart).toBe("2026-10-12");
    expect(indexStats({ days: [], missions: [] } as never, { cycleStart: "2026-11-09" }).cycleStart).toBe("2026-11-09");
  });
});

describe("schemas and settings", () => {
  const body = { id: "b1", date: "2026-10-14", weightKg: 80, steps: null, waterMl: null, sleepMin: null, note: null, ...META };

  it("a body log without kcalOverride (older app) reads as no override", () => {
    const parsed = bodyLogRow.safeParse(body);
    expect(parsed.success && parsed.data.kcalOverride).toBeNull();
  });

  it("kcalOverride must be a sensible whole number", () => {
    expect(bodyLogRow.safeParse({ ...body, kcalOverride: 2200 }).success).toBe(true);
    expect(bodyLogRow.safeParse({ ...body, kcalOverride: 200 }).success).toBe(false);
    expect(bodyLogRow.safeParse({ ...body, kcalOverride: 2200.5 }).success).toBe(false);
  });

  it("the new settings validate and have defaults", () => {
    expect(settingValueSchemas["fitness.manualKcal"].safeParse(null).success).toBe(true);
    expect(settingValueSchemas["fitness.manualKcal"].safeParse({ kcal: 2300, from: "2026-10-12" }).success).toBe(true);
    expect(settingValueSchemas["fitness.manualKcal"].safeParse({ kcal: 100, from: "2026-10-12" }).success).toBe(false);
    expect(settingValueSchemas["cycle.start"].safeParse("2026-11-09").success).toBe(true);
    expect(settingValueSchemas["cycle.start"].safeParse("soon").success).toBe(false);
    expect(DEFAULT_SETTINGS["fitness.manualKcal"]).toBeNull();
    expect(readSettings([])["cycle.start"]).toBe("2026-10-12");
  });
});
