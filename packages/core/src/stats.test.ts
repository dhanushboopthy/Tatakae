import { describe, expect, it } from "vitest";
import {
  calendarDay,
  calendarMonth,
  calendarState,
  cycleFor,
  cycleStats,
  focusMinutes,
  habitDueOn,
  habitGrid,
  habitsPct,
  indexStats,
  monthGrid,
  monthStats,
  pointBreakdown,
  rollingAverage,
  scoreboard,
  scoreOn,
  series,
  summarizeWeek,
  weekMark,
  weekStats,
  type CalendarDay,
  type StatsData,
} from "./stats";
import type { Day, DayScore, FocusSession, Goal, Habit, HabitLog, Mission, MissionStatus, Slot } from "./types";

const T = "2026-10-01T00:00:00.000Z";

function day(date: string, over: Partial<Day> = {}): Day {
  return {
    date,
    kind: "normal",
    screenMin: null,
    smallWin: null,
    qP1: null,
    qDrift: null,
    qPractised: null,
    intention: null,
    energy: null,
    forgedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: T,
    deletedAt: null,
    ...over,
  };
}

let seq = 0;
function mission(dayDate: string | null, slot: Slot, status: MissionStatus, over: Partial<Mission> = {}): Mission {
  seq++;
  return {
    id: `m${String(seq).padStart(4, "0")}`,
    title: `${slot} ${dayDate ?? "backlog"}`,
    dayDate,
    slot,
    points: null,
    status,
    minimum: "min",
    ifThen: "if then",
    resumeNote: null,
    goalId: null,
    estMin: null,
    actualMin: null,
    rescheduleCount: 0,
    updatedAt: T,
    deletedAt: null,
    ...over,
  };
}

/** A fully done day (P1–P3 done). */
function strongDay(date: string, over: Partial<Day> = {}): { d: Day; ms: Mission[] } {
  return {
    d: day(date, over),
    ms: [mission(date, "P1", "done"), mission(date, "P2", "done"), mission(date, "P3", "done")],
  };
}

function data(parts: { d: Day; ms: Mission[] }[], extra: Partial<StatsData> = {}): StatsData {
  return { days: parts.map((p) => p.d), missions: parts.flatMap((p) => p.ms), ...extra };
}

describe("calendarState", () => {
  const base = { today: "2026-10-20", kind: "normal" as const, mark: "Strong" as const, missed: false, hasData: true };
  it.each([
    [{ date: "2026-10-20" }, "Today"],
    [{ date: "2026-10-21" }, "Future"],
    [{ date: "2026-10-19", kind: "rest" as const }, "Rest"],
    [{ date: "2026-10-19", kind: "write_off" as const }, "WriteOff"],
    [{ date: "2026-10-19", missed: true }, "Missed"],
    [{ date: "2026-10-19", hasData: false }, "Unplanned"],
    [{ date: "2026-10-19", mark: "Solid" as const }, "Solid"],
  ])("%o → %s", (over, expected) => {
    expect(calendarState({ ...base, ...over })).toBe(expected);
  });
});

describe("pointBreakdown", () => {
  it("splits points by status and skips side quests and moved missions", () => {
    const ms = [
      mission("2026-10-19", "P1", "done", { points: 2 }),
      mission("2026-10-19", "P2", "minimum"),
      mission("2026-10-19", "P3", "missed"),
      mission("2026-10-19", "side", "done"),
      mission("2026-10-19", "P3", "rescheduled"),
      mission("2026-10-19", "P2", "open"),
    ];
    expect(pointBreakdown(ms)).toEqual({ done: 2, minimum: 1, missed: 1, open: 1 });
    expect(pointBreakdown(ms, true)).toEqual({ done: 2, minimum: 1, missed: 2, open: 0 });
  });
});

describe("focusMinutes", () => {
  it("counts finished sessions only, clamped", () => {
    expect(focusMinutes({ startedAt: "2026-10-19T03:00:00Z", endedAt: "2026-10-19T03:50:00Z" })).toBe(50);
    expect(focusMinutes({ startedAt: "2026-10-19T03:00:00Z", endedAt: null })).toBe(0);
    expect(focusMinutes({ startedAt: "2026-10-19T03:00:00Z", endedAt: "2026-10-19T02:00:00Z" })).toBe(0);
    expect(focusMinutes({ startedAt: "2026-10-19T00:00:00Z", endedAt: "2026-10-20T00:00:00Z" })).toBe(600);
  });
});

describe("scoreOn / calendarDay", () => {
  it("scores a closed past day and keeps today open", () => {
    const ix = indexStats(data([strongDay("2026-10-19"), { d: day("2026-10-20"), ms: [mission("2026-10-20", "P1", "open")] }]), {
      today: "2026-10-20",
    });
    const past = calendarDay(ix, "2026-10-19");
    expect(past.state).toBe("Strong");
    expect(past.final).toBe(100);
    expect(past.done).toBe(3);
    const today = calendarDay(ix, "2026-10-20");
    expect(today.state).toBe("Today");
    expect(today.final).toBeNull();
    expect(today.open).toBe(1);
    expect(scoreOn(ix, "2026-10-20").missed).toBe(false);
  });

  it("an unsaved day after first use is a missed day with final 0; before first use it is empty", () => {
    const ix = indexStats(data([strongDay("2026-10-15"), strongDay("2026-10-19")]), { today: "2026-10-20" });
    expect(calendarDay(ix, "2026-10-17").state).toBe("Missed");
    expect(calendarDay(ix, "2026-10-17").final).toBe(0);
    expect(calendarDay(ix, "2026-10-10").state).toBe("Unplanned");
    expect(calendarDay(ix, "2026-10-10").final).toBeNull();
  });

  it("today is closed once tomorrow is forged", () => {
    const ix = indexStats(data([strongDay("2026-10-20"), { d: day("2026-10-21"), ms: [] }]), { today: "2026-10-20" });
    expect(scoreOn(ix, "2026-10-20").closed).toBe(true);
    expect(calendarDay(ix, "2026-10-20").final).toBe(100);
  });

  it("marks notes and rest days", () => {
    const ix = indexStats(data([{ d: day("2026-10-18", { kind: "rest", smallWin: "Slept well" }), ms: [] }]), { today: "2026-10-20" });
    const c = calendarDay(ix, "2026-10-18");
    expect(c.state).toBe("Rest");
    expect(c.hasNote).toBe(true);
    expect(c.final).toBeNull();
  });
});

describe("monthGrid", () => {
  it("pads to Monday-first weeks", () => {
    const ix = indexStats(data([]), { today: "2026-10-20" });
    const grid = monthGrid("2026-10", calendarMonth(ix, "2026-10"));
    // 1 Oct 2026 is a Thursday → 3 leading blanks.
    expect(grid[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[0]?.[3]?.date).toBe("2026-10-01");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe("rollingAverage", () => {
  it("averages the window and skips nulls", () => {
    const pts = [
      { date: "a", value: 10 },
      { date: "b", value: null },
      { date: "c", value: 20 },
      { date: "d", value: 40 },
    ];
    expect(rollingAverage(pts, 2).map((p) => p.value)).toEqual([10, 10, 20, 30]);
    expect(rollingAverage([{ date: "a", value: null }]).map((p) => p.value)).toEqual([null]);
  });
});

describe("series", () => {
  it("final ends yesterday and screen minutes come from days", () => {
    const ix = indexStats(data([strongDay("2026-10-18", { screenMin: 90 }), strongDay("2026-10-19", { screenMin: 200 })]), {
      today: "2026-10-20",
    });
    const f = series(ix, "final", 3);
    expect(f.points.map((p) => p.date)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19"]);
    expect(f.points.map((p) => p.value)).toEqual([null, 100, 90]); // 200 min → −10
    const s = series(ix, "screen_min", 3);
    expect(s.points.map((p) => p.value)).toEqual([90, 200, null]);
    expect(s.average).toBe(145);
    expect(s.summary).toContain("145 min");
  });

  it("focus minutes per app day", () => {
    const fs: FocusSession = {
      id: "f1",
      missionId: null,
      areaId: null,
      startedAt: "2026-10-19T03:00:00.000Z", // 08:30 IST
      endedAt: "2026-10-19T03:25:00.000Z",
      plannedMin: 25,
      completed: true,
      updatedAt: T,
      deletedAt: null,
    };
    const ix = indexStats(data([], { focusSessions: [fs] }), { today: "2026-10-20" });
    expect(series(ix, "focus_min", 2).points.map((p) => p.value)).toEqual([25, 0]);
  });
});

describe("habits", () => {
  const habit = (id: string, frequency: string, active = true): Habit => ({
    id,
    anchor: null,
    behaviour: `Habit ${id}`,
    minimum: null,
    frequency,
    areaId: null,
    active,
    updatedAt: T,
    deletedAt: null,
  });
  const log = (habitId: string, date: string, done = true): HabitLog => ({ habitId, date, done, updatedAt: T, deletedAt: null });

  it.each([
    ["daily", "2026-10-18", true],
    ["weekdays", "2026-10-18", false], // Sunday
    ["weekdays", "2026-10-19", true],
    ["weekends", "2026-10-18", true],
    ["1,3", "2026-10-21", true], // Wednesday
    ["1,3", "2026-10-20", false],
  ])("%s due on %s → %s", (frequency, date, expected) => {
    expect(habitDueOn({ frequency }, date)).toBe(expected);
  });

  it("percent of due checks, skipping rest days and the future", () => {
    const ix = indexStats(
      data([{ d: day("2026-10-18", { kind: "rest" }), ms: [] }], {
        habits: [habit("h1", "daily"), habit("h2", "daily", false)],
        habitLogs: [log("h1", "2026-10-19"), log("h1", "2026-10-18")],
      }),
      { today: "2026-10-20" },
    );
    // Due: 19, 20 (18 is rest, 21+ future) → 1 of 2.
    expect(habitsPct(ix, "2026-10-18", "2026-10-25")).toBe(50);
    const grid = habitGrid(ix, 4, "2026-10-21");
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0]?.cells).toEqual(["rest", "done", "not", "none"]);
  });
});

describe("weekMark / summarizeWeek", () => {
  const sc = (final: number, over: Partial<DayScore> = {}): DayScore => ({
    excluded: false,
    planned: 3,
    earned: 3,
    exec: final,
    penalty: 0,
    bonus: 0,
    final,
    mark: "Strong",
    missedDay: false,
    ...over,
  });
  it("averages non-excluded days", () => {
    expect(weekMark([sc(90), sc(80)])).toBe("Strong");
    expect(weekMark([sc(60), sc(50), sc(0, { excluded: true })])).toBe("Solid");
    expect(weekMark([sc(10, { missedDay: true }), sc(0, { missedDay: true }), sc(40)])).toBe("Missed");
    expect(weekMark([sc(40), sc(30)])).toBe("Light");
    expect(weekMark([sc(0, { excluded: true })])).toBe("Unplanned");
  });

  it("names the dip", () => {
    const cd = (date: string, state: CalendarDay["state"], final: number | null): CalendarDay => ({
      date,
      state,
      kind: "normal",
      final,
      done: 0,
      minimum: 0,
      missed: 0,
      open: 0,
      screenMin: null,
      focusMin: 0,
      hasNote: false,
    });
    expect(summarizeWeek([cd("2026-10-19", "Strong", 100), cd("2026-10-21", "Light", 30), cd("2026-10-22", "Future", null)])).toBe(
      "1 of 3 days Strong or Solid; Wed was the dip.",
    );
    expect(summarizeWeek([cd("2026-10-22", "Future", null)])).toBe("No closed days yet.");
  });
});

describe("weekStats / monthStats", () => {
  it("collects a week", () => {
    const ix = indexStats(
      data([strongDay("2026-10-19", { screenMin: 60 }), { d: day("2026-10-20"), ms: [mission("2026-10-20", "P1", "missed")] }], {
        stuckEvents: [
          { id: "s1", missionId: "x", blocker: "fear", unblocker: null, at: "2026-10-19T06:00:00.000Z", updatedAt: T, deletedAt: null },
        ],
      }),
      { today: "2026-10-22" },
    );
    const w = weekStats(ix, { year: 2026, week: 43 });
    expect(w.week).toBe("2026-W43");
    expect(w.start).toBe("2026-10-19");
    expect(w.days).toHaveLength(7);
    expect(w.stuck).toEqual({ uncertainty: 0, fear: 1, inertia: 0 });
    expect(w.screenAvg).toBe(60);
    expect(w.average).toBe(33); // 19th 100, 20th 0 (P1 missed), 21st 0 (nothing saved → missed)
  });

  it("counts marks for a month", () => {
    const ix = indexStats(data([strongDay("2026-10-05"), { d: day("2026-10-06", { kind: "rest" }), ms: [] }]), { today: "2026-10-08" });
    const m = monthStats(ix, "2026-10");
    expect(m.marks.Strong).toBe(1);
    expect(m.marks.Rest).toBe(1);
    expect(m.marks.Missed).toBe(1); // 7 Oct, after first use, nothing saved
    expect(m.daysShownUp).toBe(1);
  });
});

describe("cycle", () => {
  it("cycleFor numbers consecutive 12-week cycles", () => {
    expect(cycleFor("2026-10-12")).toEqual({ index: 1, start: "2026-10-12", end: "2027-01-03" });
    expect(cycleFor("2027-01-04")).toEqual({ index: 2, start: "2027-01-04", end: "2027-03-28" });
    expect(cycleFor("2026-09-01").index).toBe(1);
  });

  it("gauge weeks, shown-up %, goal rings", () => {
    const goal: Goal = {
      id: "g1",
      name: "Terraform",
      areaId: "a1",
      status: "active",
      intent: null,
      outcome: null,
      niceGoal: null,
      nextAction: null,
      why: null,
      hellYeah: true,
      targetPoints: 4,
      start: null,
      end: null,
      updatedAt: T,
      deletedAt: null,
    };
    const parts = [
      { d: day("2026-10-12"), ms: [mission("2026-10-12", "P1", "done", { goalId: "g1" })] },
      { d: day("2026-10-13"), ms: [mission("2026-10-13", "P1", "minimum", { goalId: "g1" })] },
    ];
    const ix = indexStats(
      data(parts, { goals: [goal], areas: [{ id: "a1", name: "Career", standard: null, why: null, alignmentScore: null, color: "sage", icon: null, updatedAt: T, deletedAt: null }] }),
      { today: "2026-10-15" },
    );
    const c = cycleStats(ix);
    expect(c.weeks).toHaveLength(12);
    expect(c.weekMarks[1]).toBe("Future");
    expect(c.daysElapsed).toBe(3); // 12, 13, 14
    expect(c.daysShownUp).toBe(2); // 14 is missed
    expect(c.pct).toBe(67);
    expect(c.word).toBe("Steady");
    expect(c.goals[0]).toMatchObject({ id: "g1", earned: 1.5, progressPct: 38, color: "sage" });
  });
});

describe("scoreboard", () => {
  it("builds every box with calm copy", () => {
    const parts = [strongDay("2026-10-13", { screenMin: 100 }), strongDay("2026-10-14", { screenMin: 140 })];
    const ix = indexStats(
      data(parts, {
        inbox: [{ id: "i1", text: "x", createdAt: "2026-10-12T05:00:00.000Z", processed: false, updatedAt: T, deletedAt: null }],
      }),
      { today: "2026-10-15" },
    );
    const boxes = scoreboard(ix, { focusWeekTarget: 300 });
    const by = Object.fromEntries(boxes.map((b) => [b.key, b]));
    expect(boxes.map((b) => b.key)).toEqual([
      "today_score",
      "days_shown_up",
      "avg_7d",
      "p1_hit_rate",
      "focus_week",
      "screen_avg",
      "habits_week",
      "comebacks",
      "inbox",
    ]);
    expect(by["today_score"]?.value).toBeNull();
    expect(by["today_score"]?.context).toBe("Shown after shutdown");
    expect(by["days_shown_up"]?.value).toBe(2);
    expect(by["days_shown_up"]?.context).toBe("of 84 days in Cycle 1");
    expect(by["avg_7d"]?.value).toBe(100);
    expect(by["p1_hit_rate"]?.value).toBe(100);
    expect(by["screen_avg"]?.value).toBe(120);
    expect(by["screen_avg"]?.progress).toBe(100);
    expect(by["inbox"]?.value).toBe(1);
    expect(by["inbox"]?.context).toBe("Oldest 3 days old");
    expect(by["focus_week"]?.target).toBe(300);
  });
});
