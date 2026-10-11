import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORING,
  averageScore,
  capacityCheck,
  comebackBonus,
  daysShownUp,
  earnedPoints,
  execScore,
  firstUseDate,
  isMissedDay,
  markFor,
  missionPoints,
  plannedPoints,
  scoreDay,
  scoringFromSettings,
  screenPenalty,
  type ScoredMission,
} from "./scoring";
import type { DayKind, DayScore, MissionStatus, Slot } from "./types";

// Table-driven tests for every rule in docs/02-method.md (Scoring).

const m = (slot: Slot, status: MissionStatus, points: number | null = null, deletedAt: string | null = null): ScoredMission => ({
  slot,
  status,
  points,
  deletedAt,
});
const normal = (screenMin: number | null = null) => ({ kind: "normal" as DayKind, screenMin });

describe("missionPoints", () => {
  it.each([
    [null, 1],
    [1, 1],
    [3, 3],
  ])("points %s → %s (blank counts as 1)", (points, expected) => {
    expect(missionPoints({ points })).toBe(expected);
  });
});

describe("plannedPoints", () => {
  it.each<[string, ScoredMission[], number]>([
    ["empty", [], 0],
    ["blank points count as 1", [m("P1", "open"), m("P2", "done")], 2],
    ["rescheduled and backlog are excluded", [m("P1", "done"), m("P2", "rescheduled"), m("backlog", "backlog")], 1],
    ["explicit points", [m("P1", "open", 3), m("P2", "missed", 2)], 5],
    ["soft-deleted missions are ignored", [m("P1", "open"), m("P2", "open", null, "2026-10-20T00:00:00Z")], 1],
  ])("%s", (_name, missions, expected) => {
    expect(plannedPoints(missions)).toBe(expected);
  });
});

describe("earnedPoints", () => {
  it.each<[string, ScoredMission[], number]>([
    ["done earns full", [m("P1", "done", 2)], 2],
    ["minimum earns half", [m("P1", "minimum", 3)], 1.5],
    ["missed and open earn 0", [m("P1", "missed"), m("P2", "open")], 0],
    ["mixed", [m("P1", "done"), m("P2", "minimum"), m("P3", "missed")], 1.5],
  ])("%s", (_name, missions, expected) => {
    expect(earnedPoints(missions)).toBe(expected);
  });
});

describe("execScore", () => {
  it.each([
    [0, 0, 0],
    [0, 5, 0],
    [3, 3, 100],
    [3, 1.5, 50],
    [3, 2, 67],
    [3, 1, 33],
  ])("planned %s earned %s → %s", (planned, earned, expected) => {
    expect(execScore(planned, earned)).toBe(expected);
  });
});

describe("screenPenalty", () => {
  it.each<[number | null, number]>([
    [null, 0],
    [0, 0],
    [120, 0],
    [149, 0],
    [150, 0 - 5],
    [179, 0 - 5],
    [180, 0 - 10],
    [240, 0 - 20],
    [600, 0 - 20],
  ])("screen %s → %s", (screen, expected) => {
    expect(screenPenalty(screen)).toBe(expected);
  });

  it("never returns -0", () => {
    expect(Object.is(screenPenalty(60), 0)).toBe(true);
  });
});

describe("comebackBonus", () => {
  it.each<[string, boolean, ScoredMission[], number]>([
    ["yesterday missed + P1 done", true, [m("P1", "done")], 10],
    ["yesterday missed + P1 minimum", true, [m("P1", "minimum")], 10],
    ["yesterday missed + P1 missed", true, [m("P1", "missed"), m("P2", "done")], 0],
    ["yesterday missed + P1 open", true, [m("P1", "open")], 0],
    ["yesterday not missed", false, [m("P1", "done")], 0],
    ["no P1 at all", true, [m("P2", "done")], 0],
  ])("%s → %s", (_name, missed, missions, expected) => {
    expect(comebackBonus(missed, missions)).toBe(expected);
  });
});

describe("markFor", () => {
  it.each([
    [100, 3, "Strong"],
    [80, 3, "Strong"],
    [79, 3, "Solid"],
    [50, 1, "Solid"],
    [49, 1, "Light"],
    [0, 2, "Light"],
    [0, 0, "Unplanned"],
    [100, 0, "Unplanned"],
  ])("final %s planned %s → %s", (final, planned, expected) => {
    expect(markFor(final, planned)).toBe(expected);
  });
});

describe("scoreDay — examples from docs/02-method.md", () => {
  it.each<[string, ScoredMission[], number, boolean, Partial<DayScore>]>([
    [
      "all 3 done, 90 min screen",
      [m("P1", "done"), m("P2", "done"), m("P3", "done")],
      90,
      false,
      { planned: 3, earned: 3, exec: 100, penalty: 0, bonus: 0, final: 100, mark: "Strong", missedDay: false },
    ],
    [
      "P1 done, P2 minimum, P3 missed, 160 min",
      [m("P1", "done"), m("P2", "minimum"), m("P3", "missed")],
      160,
      false,
      { planned: 3, earned: 1.5, exec: 50, penalty: 0 - 5, bonus: 0, final: 45, mark: "Light", missedDay: false },
    ],
    [
      "comeback day: P1 minimum only, 100 min",
      [m("P1", "minimum")],
      100,
      true,
      { planned: 1, earned: 0.5, exec: 50, penalty: 0, bonus: 10, final: 60, mark: "Solid", missedDay: false },
    ],
  ])("%s", (_name, missions, screen, yesterdayMissed, expected) => {
    expect(scoreDay(normal(screen), missions, yesterdayMissed)).toMatchObject({ excluded: false, ...expected });
  });
});

describe("scoreDay — rules", () => {
  it("exec is 0 when nothing planned and mark is Unplanned (missed day)", () => {
    expect(scoreDay(normal(), [], false)).toMatchObject({ planned: 0, exec: 0, final: 0, mark: "Unplanned", missedDay: true });
  });

  it("final is clamped to 0..100", () => {
    const high = scoreDay(normal(0), [m("P1", "done")], true);
    expect(high.final).toBe(100);
    const low = scoreDay(normal(600), [m("P1", "missed")], false);
    expect(low.final).toBe(0);
  });

  it.each<[string, ScoredMission[], boolean]>([
    ["exec 0 → missed", [m("P1", "missed")], true],
    ["exec 20 → missed", [m("P1", "done", 1), m("P2", "missed", 2), m("P3", "missed", 2)], true],
    ["exec 25 → not missed", [m("P1", "minimum", 2), m("P2", "missed", 2)], false],
    ["only rescheduled → planned 0 → missed", [m("P1", "rescheduled")], true],
  ])("missed day: %s", (_name, missions, expected) => {
    expect(scoreDay(normal(), missions, false).missedDay).toBe(expected);
  });

  it.each<DayKind>(["rest", "write_off"])("%s days are excluded and never missed", (kind) => {
    const sc = scoreDay({ kind, screenMin: null }, [], false);
    expect(sc.excluded).toBe(true);
    expect(sc.missedDay).toBe(false);
  });

  it("uses custom scoring settings", () => {
    // exec 75: Solid by default, Strong when strongAt is lowered to 70.
    expect(scoreDay(normal(), [m("P1", "done"), m("P2", "minimum")], false).mark).toBe("Solid");
    const s = { ...DEFAULT_SCORING, strongAt: 70 };
    expect(scoreDay(normal(), [m("P1", "done"), m("P2", "minimum")], false, s).mark).toBe("Strong");
  });
});

describe("isMissedDay", () => {
  type Ctx = { firstUseDate: string | null; today: string };
  const ctx: Ctx = { firstUseDate: "2026-10-19", today: "2026-10-25" };
  it.each<[string, string, { kind: DayKind } | null, ScoredMission[], Ctx, boolean]>([
    ["no row, no missions, after first use, before today", "2026-10-21", null, [], ctx, true],
    ["no row, before first use", "2026-10-18", null, [], ctx, false],
    ["no row, on first-use date", "2026-10-19", null, [], ctx, true],
    ["no row, today", "2026-10-25", null, [], ctx, false],
    ["no row, future", "2026-10-26", null, [], ctx, false],
    ["no row, no first use yet", "2026-10-21", null, [], { firstUseDate: null, today: "2026-10-25" }, false],
    ["normal day, P1 done", "2026-10-21", { kind: "normal" }, [m("P1", "done")], ctx, false],
    ["normal day, nothing planned", "2026-10-21", { kind: "normal" }, [], ctx, true],
    ["normal day, exec < 25", "2026-10-21", { kind: "normal" }, [m("P1", "missed")], ctx, true],
    ["rest day", "2026-10-21", { kind: "rest" }, [], ctx, false],
    ["write-off day", "2026-10-21", { kind: "write_off" }, [m("P1", "missed")], ctx, false],
    ["missions but no day row", "2026-10-21", null, [m("P1", "done")], ctx, false],
  ])("%s", (_name, date, day, missions, c, expected) => {
    expect(isMissedDay(date, day, missions, c)).toBe(expected);
  });
});

describe("firstUseDate", () => {
  it("returns the earliest non-deleted date", () => {
    expect(
      firstUseDate([
        { date: "2026-10-21" },
        { date: "2026-10-12", deletedAt: "2026-10-13T00:00:00Z" },
        { date: "2026-10-19" },
      ]),
    ).toBe("2026-10-19");
  });
  it("returns null when empty", () => {
    expect(firstUseDate([])).toBeNull();
  });
});

const sc = (final: number, excluded = false, missedDay = false): DayScore => ({
  excluded,
  planned: 3,
  earned: 0,
  exec: final,
  penalty: 0,
  bonus: 0,
  final,
  mark: "Solid",
  missedDay,
});

describe("averageScore", () => {
  it.each<[string, DayScore[], number | null]>([
    ["empty → null", [], null],
    ["only excluded → null", [sc(100, true)], null],
    ["rest and write_off days are excluded", [sc(100), sc(50), sc(0, true)], 75],
    ["rounds to an integer", [sc(100), sc(50), sc(50)], 67],
  ])("%s", (_name, scores, expected) => {
    expect(averageScore(scores)).toBe(expected);
  });
});

describe("daysShownUp", () => {
  it("counts non-excluded, non-missed days", () => {
    expect(daysShownUp([sc(100), sc(0, false, true), sc(0, true), sc(60)])).toBe(2);
  });

  it("never decreases as days are appended", () => {
    const history: DayScore[] = [];
    let prev = 0;
    for (const s of [sc(100), sc(0, false, true), sc(0, true), sc(45), sc(0, false, true)]) {
      history.push(s);
      const now = daysShownUp(history);
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(prev).toBe(2);
  });
});

describe("capacityCheck", () => {
  it.each<[number, number, { ratio: number; overCapacity: boolean; budgetMin: number }]>([
    [240, 300, { ratio: 1, overCapacity: false, budgetMin: 240 }],
    [120, 300, { ratio: 0.5, overCapacity: false, budgetMin: 240 }],
    [300, 300, { ratio: 1.25, overCapacity: true, budgetMin: 240 }],
    [0, 0, { ratio: 0, overCapacity: false, budgetMin: 0 }],
    [30, 0, { ratio: Infinity, overCapacity: true, budgetMin: 0 }],
  ])("planned %s of free %s", (planned, free, expected) => {
    expect(capacityCheck(planned, free)).toEqual(expected);
  });
});

describe("scoringFromSettings", () => {
  it.each<[string, unknown, Partial<typeof DEFAULT_SCORING>]>([
    ["null → defaults", null, {}],
    ["garbage string → defaults", "not json", {}],
    ["partial object merges", { strongAt: 90 }, { strongAt: 90 }],
    ["JSON string merges", JSON.stringify({ screenFreeMin: 90 }), { screenFreeMin: 90 }],
    ["invalid values fall back", { strongAt: "high", solidAt: -1, comebackBonus: Number.NaN }, {}],
    ["unknown keys are dropped", { foo: 1 }, {}],
  ])("%s", (_name, value, overrides) => {
    expect(scoringFromSettings(value)).toEqual({ ...DEFAULT_SCORING, ...overrides });
  });
});
