import { describe, expect, it } from "vitest";
import type {
  BodyLog, FitnessPhase, Food, FoodLog, MaintenanceWeek, OutboxItem, SyncResponse, Workout, WorkoutSet,
} from "@tatakae/core";
import { getRow } from "../lib/rows.service";
import { at, call, setup, type TestApp } from "../test/helpers";

// Fitness tables (F2) round-trip through POST /sync like every other synced table.

let seq = 0;
function item(table: OutboxItem["table"], row: object, extra: Partial<OutboxItem> = {}): OutboxItem {
  const r = row as Record<string, unknown>;
  seq += 1;
  return { id: `fit-${seq}`, table, op: "upsert", row: r, updatedAt: typeof r["updatedAt"] === "string" ? r["updatedAt"] : at(0), ...extra };
}

async function sync(app: TestApp, items: OutboxItem[], cursor: string | null = "0"): Promise<SyncResponse> {
  const res = await call(app, "POST", "/sync", { client: "mobile", cursor, items });
  expect(res.status).toBe(200);
  return res.body as unknown as SyncResponse;
}

const rowsOf = (res: SyncResponse, table: string) => res.changes.filter((c) => c.table === table).map((c) => c.row);
const meta = (minutes = 0) => ({ updatedAt: at(minutes), deletedAt: null });

const body = (o: Partial<BodyLog> = {}): BodyLog => ({
  id: "B1", date: "2026-10-20", weightKg: 82.4, steps: 9100, waterMl: 2750, sleepMin: 445, note: null, ...meta(), ...o,
});
const food = (o: Partial<Food> = {}): Food => ({
  id: "F1", name: "Paneer", servingLabel: "100 g", servingG: 100, kcal: 265, proteinG: 18.3, carbsG: 1.2, fatG: 20.8,
  fibreG: null, micros: { calcium: 208, sodium: 18 }, favourite: true, ...meta(), ...o,
});
const foodLog = (o: Partial<FoodLog> = {}): FoodLog => ({
  id: "FL1", date: "2026-10-20", meal: "lunch", foodId: "F1", name: "Paneer", servings: 1.5, kcal: 265, proteinG: 18.3,
  carbsG: 1.2, fatG: 20.8, fibreG: null, micros: { calcium: 208 }, ...meta(), ...o,
});
const phase = (o: Partial<FitnessPhase> = {}): FitnessPhase => ({
  id: "P1", kind: "cut", startDate: "2026-10-19", endDate: null, ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8,
  startWeightKg: 82.6, note: null, ...meta(), ...o,
});
const workout = (o: Partial<Workout> = {}): Workout => ({ id: "W1", date: "2026-10-20", name: "Push", durationMin: 55, note: null, ...meta(), ...o });
const set = (o: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: "S1", workoutId: "W1", exercise: "Bench press", muscle: "chest", order: 0, reps: 5, kg: 80, rpe: 8.5, ...meta(), ...o,
});
const maintenance = (o: Partial<MaintenanceWeek> = {}): MaintenanceWeek => ({ id: "M1", isoWeek: "2026-W43", kcal: 2800, note: null, ...meta(), ...o });

describe("POST /sync — fitness tables", () => {
  it("every fitness table round-trips unchanged (reals, JSON micros, booleans)", async () => {
    const { app } = await setup();
    const rows = [
      item("body_logs", body()), item("foods", food()), item("food_logs", foodLog()), item("fitness_phases", phase()),
      item("workouts", workout()), item("workout_sets", set()), item("maintenance_weeks", maintenance()),
    ];
    const pushed = await sync(app, rows);
    expect(pushed.applied).toEqual(rows.map((r) => r.id));
    expect(pushed.conflicts).toEqual([]);

    const pulled = await sync(app, [], null);
    expect(rowsOf(pulled, "body_logs")).toEqual([body()]);
    expect(rowsOf(pulled, "foods")).toEqual([food()]);
    expect(rowsOf(pulled, "food_logs")).toEqual([foodLog()]);
    expect(rowsOf(pulled, "fitness_phases")).toEqual([phase()]);
    expect(rowsOf(pulled, "workouts")).toEqual([workout()]);
    expect(rowsOf(pulled, "workout_sets")).toEqual([set()]);
    expect(rowsOf(pulled, "maintenance_weeks")).toEqual([maintenance()]);
  });

  it("body_logs merge by date: two devices logging the same day keep one row, last write wins", async () => {
    const { app, db } = await setup();
    await sync(app, [item("body_logs", body({ id: "phone", weightKg: 82.4, updatedAt: at(1) }))]);
    const res = await sync(app, [item("body_logs", body({ id: "laptop", weightKg: 82.1, updatedAt: at(2) }))]);
    expect(res.conflicts).toEqual([]);
    expect(getRow(db, "body_logs", "2026-10-20")).toMatchObject({ id: "laptop", weightKg: 82.1 });
    expect(rowsOf(await sync(app, [], null), "body_logs")).toHaveLength(1);
  });

  it("maintenance_weeks merge by ISO week; an older write is a conflict", async () => {
    const { app, db } = await setup();
    await sync(app, [item("maintenance_weeks", maintenance({ kcal: 2750, updatedAt: at(5) }))]);
    const stale = item("maintenance_weeks", maintenance({ id: "M2", kcal: 2900, updatedAt: at(1) }));
    const res = await sync(app, [stale]);
    expect(res.conflicts.map((c) => c.id)).toEqual([stale.id]);
    expect(getRow(db, "maintenance_weeks", "2026-W43")?.kcal).toBe(2750);
  });

  it.each([
    ["food_logs with an unknown meal", "food_logs", { ...foodLog(), meal: "brunch" }],
    ["foods with an unknown micronutrient", "foods", { ...food(), micros: { caffeine: 80 } }],
    ["maintenance_weeks with a malformed week", "maintenance_weeks", { ...maintenance(), isoWeek: "2026-43" }],
    ["body_logs with an impossible weight", "body_logs", { ...body(), weightKg: 4 }],
    ["fitness_phases with an unknown kind", "fitness_phases", { ...phase(), kind: "shred" }],
  ] as const)("rejects %s as a conflict", async (_name, table, row) => {
    const { app } = await setup();
    const bad = item(table, row);
    expect((await sync(app, [bad])).conflicts).toEqual([{ id: bad.id, server: null }]);
  });

  it("delete soft-deletes a food log", async () => {
    const { app, db } = await setup();
    await sync(app, [item("food_logs", foodLog())]);
    const del = item("food_logs", foodLog({ updatedAt: at(3), deletedAt: at(3) }), { op: "delete" });
    expect((await sync(app, [del])).applied).toEqual([del.id]);
    expect(getRow(db, "food_logs", "FL1")).toMatchObject({ deletedAt: at(3), updatedAt: at(3) });
  });
});
