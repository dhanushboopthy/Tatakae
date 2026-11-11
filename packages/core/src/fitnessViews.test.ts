import { describe, expect, it } from "vitest";
import { buildFitnessMonth, buildFitnessPhase, buildFitnessWeek } from "./fitnessViews";
import type { FitnessRows } from "./fitnessDay";
import { DEFAULT_SETTINGS } from "./settings";
import type { BodyLog, FitnessPhase, FoodLog, MaintenanceWeek } from "./types";

const meta = { updatedAt: "2026-10-14T10:00:00.000Z", deletedAt: null };
const body = (date: string, weightKg: number, extra: Partial<BodyLog> = {}): BodyLog => ({
  id: `b-${date}`, date, weightKg, steps: null, waterMl: null, sleepMin: null, note: null, kcalOverride: null, ...meta, ...extra,
});
const log = (id: string, date: string, kcal: number): FoodLog => ({
  id, date, meal: "lunch", foodId: null, name: "x", servings: 1, kcal, proteinG: 10, carbsG: 5, fatG: 2, fibreG: null, micros: {}, ...meta,
});
const cut: FitnessPhase = { id: "p", kind: "cut", startDate: "2026-10-01", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 80, note: null, ...meta };
const maint: MaintenanceWeek = { id: "m1", isoWeek: "2026-W42", kcal: 2700, note: null, ...meta };

const rows = (over: Partial<FitnessRows> = {}): FitnessRows => ({
  settings: DEFAULT_SETTINGS,
  bodyLogs: [body("2026-10-12", 80), body("2026-10-14", 79.6)],
  foods: [],
  foodLogs: [log("l1", "2026-10-13", 2000), log("l2", "2026-10-14", 2600)],
  phases: [cut],
  maintenanceWeeks: [maint],
  ...over,
});

const TODAY = "2026-10-15";

describe("buildFitnessWeek", () => {
  it("gives a target for each day and the typed maintenance", () => {
    const w = buildFitnessWeek(rows(), "2026-W42", TODAY);
    expect(Object.keys(w.dayTargets)).toHaveLength(7);
    expect(w.summary.maintenanceKcal).toBe(2700);
    expect(w.phase?.id).toBe("p");
    expect(w.checkIn.length).toBeGreaterThan(5);
    expect(w.currentWeek).toBe("2026-W42");
  });

  it("a standing typed-in target shows up in every day's target from its date", () => {
    const settings = { ...DEFAULT_SETTINGS, "fitness.manualKcal": { kcal: 2300, from: "2026-10-14" } };
    const w = buildFitnessWeek(rows({ settings }), "2026-W42", TODAY);
    expect(w.dayTargets["2026-10-14"]).toBe(2300);
    expect(w.dayTargets["2026-10-13"]).not.toBe(2300);
  });

  it("ignores deleted rows", () => {
    const gone = [log("l1", "2026-10-13", 2000), { ...log("l3", "2026-10-13", 5000), deletedAt: "2026-10-14T00:00:00.000Z" }];
    const w = buildFitnessWeek(rows({ foodLogs: gone }), "2026-W42", TODAY);
    expect(w.summary.days.find((d) => d.date === "2026-10-13")?.kcal).toBe(2000);
  });
});

describe("buildFitnessMonth", () => {
  it("counts days at or under, over and not logged up to today", () => {
    const m = buildFitnessMonth(rows(), "2026-10", TODAY);
    expect(m.daysElapsed).toBe(15);
    expect(m.atOrUnder + m.over + m.notLogged).toBe(15);
    expect(m.over).toBeGreaterThanOrEqual(1); // 2600 on the 14th is over a cut target
    expect(m.phase?.id).toBe("p");
  });
});

describe("buildFitnessPhase", () => {
  it("returns the running phase, its progress and history", () => {
    const v = buildFitnessPhase(rows(), TODAY);
    expect(v.active?.id).toBe("p");
    expect(v.progress).not.toBeNull();
    expect(v.targets?.kcal).toBeGreaterThan(1000);
    expect(v.phases).toHaveLength(1);
    expect(v.latestWeightKg).toBe(79.6);
    expect(v.manualKcal).toBeNull();
  });

  it("with no phase there is no progress and targets sit at maintenance", () => {
    const v = buildFitnessPhase(rows({ phases: [] }), TODAY);
    expect(v.active).toBeNull();
    expect(v.progress).toBeNull();
  });
});
