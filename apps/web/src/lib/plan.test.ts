import { describe, expect, it } from "vitest";
import type { Anchor, Mission } from "@tatakae/core";
import {
  anchorsFor,
  bySlot,
  decideHome,
  dragRange,
  durationLabel,
  elapsedMinutes,
  firstFreeSlot,
  clampFocus,
  focusLengthFor,
  focusRemainingMs,
  formatCountdown,
  freeMinutes,
  hhmmOf,
  ifThenTemplates,
  istMinutesOf,
  railSpan,
  railTimeAt,
  rangeLabel,
  resizeTo,
  isDayClosed,
  isDayStarted,
  missionsOn,
  plannedMinutes,
  shouldPromptRitual,
  toMinutes,
  writeOffsUsed,
} from "./plan";

// Written overnight, not yet run (owner runs `pnpm test` in the morning).

const AT = "2026-10-20T10:00:00.000Z";

const mission = (over: Partial<Mission>): Mission => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  title: "t",
  dayDate: "2026-10-20",
  slot: "P1",
  points: null,
  status: "open",
  minimum: null,
  ifThen: null,
  resumeNote: null,
  goalId: null,
  estMin: null,
  actualMin: null,
  rescheduleCount: 0,
  updatedAt: AT,
  deletedAt: null,
  ...over,
});

const anchor = (startTime: string, endTime: string, weekdays = ""): Anchor => ({
  id: `${startTime}-${endTime}`,
  name: "a",
  startTime,
  endTime,
  weekdays,
  updatedAt: AT,
  deletedAt: null,
});

describe("decideHome", () => {
  it.each([
    [{ yesterdayMissed: true, todayStarted: false, welcomeBackSeen: false }, "/welcome-back"],
    [{ yesterdayMissed: true, todayStarted: true, welcomeBackSeen: false }, "/today"],
    [{ yesterdayMissed: true, todayStarted: false, welcomeBackSeen: true }, "/today"],
    [{ yesterdayMissed: false, todayStarted: false, welcomeBackSeen: false }, "/today"],
  ] as const)("%j → %s", (input, expected) => {
    expect(decideHome(input)).toBe(expected);
  });
});

describe("isDayStarted", () => {
  it("is started when the day is forged", () => {
    expect(isDayStarted({ forgedAt: AT }, [])).toBe(true);
  });
  it("is started when any mission left open", () => {
    expect(isDayStarted(null, [{ status: "open" }, { status: "minimum" }])).toBe(true);
  });
  it("is not started with only open missions and no lock", () => {
    expect(isDayStarted({ forgedAt: null }, [{ status: "open" }])).toBe(false);
    expect(isDayStarted(null, [])).toBe(false);
  });
});

describe("shouldPromptRitual", () => {
  it.each([
    ["21:29", "21:30", false, false],
    ["21:30", "21:30", false, true],
    ["23:59", "21:30", false, true],
    ["01:15", "21:30", false, true], // before the 04:00 boundary still counts as the evening
    ["04:00", "21:30", false, false],
    ["22:00", "21:30", true, false], // tomorrow already locked
  ])("now %s ritual %s forged %s → %s", (nowHHMM, ritualTime, tomorrowForged, expected) => {
    expect(shouldPromptRitual({ nowHHMM, ritualTime, tomorrowForged })).toBe(expected);
  });
});

describe("isDayClosed", () => {
  it("past days are closed", () => expect(isDayClosed("2026-10-19", "2026-10-20", false)).toBe(true));
  it("today is closed once tomorrow is locked", () => expect(isDayClosed("2026-10-20", "2026-10-20", true)).toBe(true));
  it("today is open before the ritual", () => expect(isDayClosed("2026-10-20", "2026-10-20", false)).toBe(false));
});

describe("capacity helpers", () => {
  it("toMinutes", () => {
    expect(toMinutes("06:30")).toBe(390);
    expect(toMinutes("bad")).toBe(0);
  });

  it("anchorsFor filters by weekday (0 = Sunday) and sorts by start", () => {
    // 2026-10-20 is a Tuesday (2)
    const as = [anchor("14:00", "15:00", "2,4"), anchor("09:00", "10:00", ""), anchor("11:00", "12:00", "1,3")];
    expect(anchorsFor(as, "2026-10-20").map((a) => a.startTime)).toEqual(["09:00", "14:00"]);
  });

  it("freeMinutes subtracts anchors inside the wake→ritual window, merging overlaps", () => {
    expect(freeMinutes({ wakeTime: "06:30", ritualTime: "21:30", anchors: [] })).toBe(900);
    expect(
      freeMinutes({
        wakeTime: "06:30",
        ritualTime: "21:30",
        anchors: [anchor("09:00", "13:00"), anchor("12:00", "14:00"), anchor("05:00", "07:00"), anchor("22:00", "23:00")],
      }),
    ).toBe(900 - 300 - 30);
  });

  it("freeMinutes is 0 for an empty window", () => {
    expect(freeMinutes({ wakeTime: "22:00", ritualTime: "21:30", anchors: [] })).toBe(0);
  });

  it("plannedMinutes ignores side quests, rescheduled and deleted missions", () => {
    const ms = [
      mission({ estMin: 50 }),
      mission({ slot: "P2", estMin: 25 }),
      mission({ slot: "side", estMin: 30 }),
      mission({ slot: "P3", estMin: 40, status: "rescheduled" }),
      mission({ slot: "P3", estMin: 90, deletedAt: AT }),
    ];
    expect(plannedMinutes(ms)).toBe(75);
  });
});

describe("mission helpers", () => {
  it("missionsOn returns live missions of the date in slot order", () => {
    const ms = [
      mission({ id: "s", slot: "side" }),
      mission({ id: "p2", slot: "P2" }),
      mission({ id: "p1", slot: "P1" }),
      mission({ id: "other", dayDate: "2026-10-21" }),
      mission({ id: "gone", slot: "P3", deletedAt: AT }),
    ];
    expect(missionsOn(ms, "2026-10-20").map((m) => m.id)).toEqual(["p1", "p2", "s"]);
  });

  it("bySlot prefers the mission that wasn't rescheduled", () => {
    const ms = [mission({ id: "old", status: "rescheduled" }), mission({ id: "new" })];
    expect(bySlot(ms).P1?.id).toBe("new");
  });

  it("firstFreeSlot", () => {
    const ms = [mission({ slot: "P2" })];
    expect(firstFreeSlot(ms, ["P2", "P3"])).toBe("P3");
    expect(firstFreeSlot([...ms, mission({ slot: "P3" })], ["P2", "P3"])).toBeNull();
  });

  it("ifThenTemplates returns distinct P1 plans, most recent first", () => {
    const ms = [
      mission({ dayDate: "2026-10-18", ifThen: "If it's 7:00, then I open the laptop" }),
      mission({ dayDate: "2026-10-19", ifThen: "If I finish lunch, then I start DSA" }),
      mission({ dayDate: "2026-10-17", ifThen: "if I finish lunch, then I start DSA" }),
      mission({ dayDate: "2026-10-20", slot: "P2", ifThen: "not a P1" }),
    ];
    expect(ifThenTemplates(ms)).toEqual(["If I finish lunch, then I start DSA", "If it's 7:00, then I open the laptop"]);
  });

  it("writeOffsUsed counts write-off days in the month", () => {
    const days = [
      { date: "2026-10-03", kind: "write_off" as const, deletedAt: null },
      { date: "2026-10-09", kind: "rest" as const, deletedAt: null },
      { date: "2026-11-01", kind: "write_off" as const, deletedAt: null },
    ];
    expect(writeOffsUsed(days, "2026-10")).toBe(1);
  });
});

describe("focus length", () => {
  it("uses the mission's planned minutes, else the default, kept within 5–240", () => {
    expect(focusLengthFor(75, 50)).toEqual({ minutes: 75, fromPlan: true });
    expect(focusLengthFor(null, 50)).toEqual({ minutes: 50, fromPlan: false });
    expect(focusLengthFor(0, 25)).toEqual({ minutes: 25, fromPlan: false });
    expect(focusLengthFor(600, 50)).toEqual({ minutes: 240, fromPlan: true });
    expect(clampFocus(2)).toBe(5);
    expect(clampFocus(37.4)).toBe(37);
  });
});

describe("focus timer", () => {
  const start = "2026-10-20T04:00:00.000Z";
  it("remaining time is derived from the start time", () => {
    expect(focusRemainingMs(start, 25, new Date("2026-10-20T04:10:00.000Z"))).toBe(15 * 60_000);
    expect(focusRemainingMs(start, 25, new Date("2026-10-20T05:00:00.000Z"))).toBe(0);
  });
  it("formatCountdown rounds up and pads", () => {
    expect(formatCountdown(15 * 60_000)).toBe("15:00");
    expect(formatCountdown(59_001)).toBe("01:00");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(90 * 60_000)).toBe("1:30:00");
  });
  it("elapsedMinutes is at least 1", () => {
    expect(elapsedMinutes(start, new Date(start))).toBe(1);
    expect(elapsedMinutes(start, new Date("2026-10-20T04:50:00.000Z"))).toBe(50);
  });
});

describe("week planner rail", () => {
  it("istMinutesOf reads IST wall-clock minutes", () => {
    expect(istMinutesOf("2026-10-20T03:30:00.000Z")).toBe(9 * 60); // 09:00 IST
    expect(istMinutesOf("2026-10-20T19:00:00.000Z")).toBe(30); // 00:30 IST next day
  });
  it("railSpan places and clips blocks", () => {
    expect(railSpan(6 * 60, 18 * 60)).toEqual({ top: 0, height: 1 });
    expect(railSpan(15 * 60, 54)).toEqual({ top: 0.5, height: 0.05 });
    expect(railSpan(5 * 60, 30)).toBeNull(); // before the rail
    expect(railSpan(5 * 60, 90)).toEqual({ top: 0, height: 30 / 1080 });
    expect(railSpan(30, 60)).toBeNull(); // 00:30 belongs after midnight, past the rail end
    expect(railSpan(23 * 60 + 30, 60)).toEqual({ top: (17.5 * 60) / 1080, height: 30 / 1080 });
  });
  it("hhmmOf and railTimeAt snap to the grid", () => {
    expect(hhmmOf(9 * 60 + 5)).toBe("09:05");
    expect(hhmmOf(1440 + 30)).toBe("00:30");
    expect(railTimeAt(0.5)).toBe("15:00");
    expect(railTimeAt(0.5 + 7 / 1080)).toBe("15:00");
    expect(railTimeAt(0.5 + 8 / 1080)).toBe("15:15");
    expect(railTimeAt(1)).toBe("23:45");
  });

  const at = (min: number) => (min - 6 * 60) / 1080; // rail position of a wall-clock minute
  it("dragRange snaps both ends, works upwards and keeps a minimum length", () => {
    expect(dragRange(at(9 * 60 + 7), at(10 * 60 + 53))).toEqual({ startMin: 9 * 60, durationMin: 120 });
    expect(dragRange(at(11 * 60), at(9 * 60 + 30))).toEqual({ startMin: 9 * 60 + 30, durationMin: 90 });
    expect(dragRange(at(14 * 60), at(14 * 60), { minDur: 50 })).toEqual({ startMin: 14 * 60, durationMin: 50 });
    expect(dragRange(at(23 * 60 + 50), at(23 * 60 + 50), { minDur: 50 })).toEqual({ startMin: 23 * 60 + 10, durationMin: 50 });
    expect(dragRange(-1, 2)).toEqual({ startMin: 6 * 60, durationMin: 18 * 60 });
  });
  it("resizeTo keeps at least one step and ends on the rail", () => {
    expect(resizeTo(9 * 60, at(10 * 60 + 20))).toBe(75);
    expect(resizeTo(9 * 60, at(8 * 60))).toBe(15);
    expect(resizeTo(23 * 60, 1.5)).toBe(60);
  });
  it("duration and range labels", () => {
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(120)).toBe("2 h");
    expect(durationLabel(90)).toBe("1 h 30 min");
    expect(rangeLabel(9 * 60 + 30, 90)).toBe("09:30–11:00 · 1 h 30 min");
  });
});
