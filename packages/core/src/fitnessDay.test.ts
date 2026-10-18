import { describe, expect, it } from "vitest";
import { buildFitnessDay, buildTraining, type FitnessRows } from "./fitnessDay";
import { DEFAULT_SETTINGS } from "./settings";
import type { BodyLog, FitnessPhase, Food, FoodLog } from "./types";

const meta = { updatedAt: "2026-10-14T10:00:00.000Z", deletedAt: null };
const body = (date: string, weightKg: number | null, extra: Partial<BodyLog> = {}): BodyLog => ({ id: `b-${date}`, date, weightKg, steps: null, waterMl: null, sleepMin: null, note: null, ...meta, ...extra });
const food = (id: string, name: string, extra: Partial<Food> = {}): Food => ({ id, name, servingLabel: "1", servingG: null, kcal: 100, proteinG: 10, carbsG: 5, fatG: 2, fibreG: null, micros: {}, favourite: false, ...meta, ...extra });
const log = (id: string, date: string, foodId: string | null, extra: Partial<FoodLog> = {}): FoodLog => ({
  id, date, meal: "lunch", foodId, name: "x", servings: 1, kcal: 100, proteinG: 10, carbsG: 5, fatG: 2, fibreG: null, micros: {}, ...meta, ...extra,
});
const cut: FitnessPhase = { id: "p", kind: "cut", startDate: "2026-09-01", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8, startWeightKg: 90, note: null, ...meta };

const rows = (over: Partial<FitnessRows> = {}): FitnessRows => ({
  settings: DEFAULT_SETTINGS,
  bodyLogs: [],
  foods: [],
  foodLogs: [],
  phases: [],
  maintenanceWeeks: [],
  ...over,
});

describe("buildTraining", () => {
  const w = (id: string, date: string, extra = {}) => ({ id, date, name: "Push", durationMin: null, note: null, ...meta, ...extra });
  const s = (id: string, workoutId: string, exercise: string, kg: number, reps: number, order: number, extra = {}) => ({
    id, workoutId, exercise, muscle: "Chest", order, reps, kg, rpe: null, ...meta, ...extra,
  });

  it("newest sessions first, sets of deleted sessions dropped, exercises by use, lifts since the phase start", () => {
    const t = buildTraining("2026-10-14", {
      phases: [cut],
      workouts: [w("a", "2026-08-20"), w("b", "2026-10-10"), w("c", "2026-10-14"), w("x", "2026-10-12", { deletedAt: "2026-10-12T20:00:00.000Z" })],
      sets: [
        s("1", "a", "Bench", 70, 8, 0), s("2", "b", "Bench", 80, 5, 0), s("3", "b", "Bench", 80, 5, 1),
        s("4", "c", "Row", 60, 10, 0, { muscle: "Back" }), s("5", "x", "Squat", 100, 5, 0),
      ],
    });
    expect(t.workouts.map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(t.sets.map((x) => x.id)).toEqual(["1", "2", "4", "3"]); // by order, then id; set 5 belongs to a deleted session
    expect(t.exercises).toEqual([{ name: "Bench", muscle: "Chest" }, { name: "Row", muscle: "Back" }]);
    expect(t.since).toBe("2026-09-01");
    expect(t.phase?.id).toBe("p");
    const bench = t.lifts.find((l) => l.exercise === "Bench");
    expect(bench).toMatchObject({ kg: 80, reps: 5, e1rm: 93.3, previousE1rm: 88.7, delta: 4.6 });
  });

  it("without a phase 'since' is 28 days ago", () => {
    expect(buildTraining("2026-10-14", { phases: [], workouts: [], sets: [] })).toMatchObject({ since: "2026-09-16", phase: null, lifts: [], exercises: [] });
  });
});

describe("buildFitnessDay", () => {
  it("composes targets, totals, body, trend and the phase label for a date", () => {
    const d = buildFitnessDay("2026-10-14", rows({
      phases: [cut],
      bodyLogs: [body("2026-10-13", 85), body("2026-10-14", 84.8, { steps: 6000 })],
      foods: [food("f1", "Whey")],
      foodLogs: [log("l1", "2026-10-14", "f1", { kcal: 300, servings: 2 }), log("l0", "2026-10-13", "f1")],
      maintenanceWeeks: [{ id: "m", isoWeek: "2026-W41", kcal: 2750, note: null, ...meta }],
    }));
    expect(d.phaseText).toBe("Cut · week 7 · −1 % a week");
    expect(d.maintenance).toEqual({ kcal: 2750, setForThisWeek: false, fromWeek: "2026-W41" });
    expect(d.targets?.kcal).toBe(1815); // trend ≈ 85 → 935 kcal under 2750
    expect(d.totals.kcal).toBe(600);
    expect(d.body?.steps).toBe(6000);
    expect(d.previousWeightKg).toBe(85);
    expect(d.logs.map((l) => l.id)).toEqual(["l1"]);
    expect(d.yesterdayLogs.map((l) => l.id)).toEqual(["l0"]);
    expect(d.recentFoods.map((f) => f.id)).toEqual(["f1"]);
    expect(d.recentTrend.length).toBeGreaterThan(0);
  });

  it("with nothing logged: no targets, no phase, default maintenance", () => {
    const d = buildFitnessDay("2026-10-14", rows());
    expect(d).toMatchObject({ phase: null, phaseText: null, trendKg: null, targets: null, body: null, previousWeightKg: null });
    expect(d.maintenance.kcal).toBe(2800);
    expect(d.totals.entries).toBe(0);
  });

  it("ignores deleted rows everywhere", () => {
    const gone = { deletedAt: "2026-10-14T11:00:00.000Z" };
    const d = buildFitnessDay("2026-10-14", rows({
      phases: [{ ...cut, ...gone }],
      bodyLogs: [body("2026-10-14", 99, gone)],
      foods: [food("f1", "Old", gone)],
      foodLogs: [log("l1", "2026-10-14", "f1", gone)],
    }));
    expect(d).toMatchObject({ phase: null, body: null, trendKg: null });
    expect(d.foods).toEqual([]);
    expect(d.logs).toEqual([]);
    expect(d.totals.kcal).toBe(0);
  });

  it("sorts foods by name and recent foods skip deleted foods", () => {
    const d = buildFitnessDay("2026-10-14", rows({
      foods: [food("b", "Banana"), food("a", "Apple"), food("c", "Gone", { deletedAt: "2026-10-01T00:00:00.000Z" })],
      foodLogs: [log("l1", "2026-10-12", "c"), log("l2", "2026-10-13", "a")],
    }));
    expect(d.foods.map((f) => f.name)).toEqual(["Apple", "Banana"]);
    expect(d.recentFoods.map((f) => f.id)).toEqual(["a"]);
  });
});
