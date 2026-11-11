import { describe, expect, it } from "vitest";
import {
  addDays,
  canEditScoring,
  daysBetween,
  formatIsoWeek,
  isIsoDate,
  isoWeek,
  isoWeekRange,
  istTimeHHMM,
  isNightTime,
  monthOf,
  monthRange,
  parseIsoWeek,
  todayIST,
  weekdayOf,
} from "./time";

describe("todayIST (Asia/Kolkata, 04:00 boundary)", () => {
  it.each([
    ["2026-10-11T18:30:00Z", "2026-10-11"], // 00:00 IST Oct 12 → still Oct 11
    ["2026-10-11T22:29:00Z", "2026-10-11"], // 03:59 IST
    ["2026-10-11T22:30:00Z", "2026-10-12"], // 04:00 IST
    ["2026-10-12T03:00:00Z", "2026-10-12"], // 08:30 IST
    ["2026-10-12T18:00:00Z", "2026-10-12"], // 23:30 IST
    ["2026-12-31T22:29:00Z", "2026-12-31"], // 03:59 IST Jan 1
    ["2026-12-31T22:30:00Z", "2027-01-01"], // 04:00 IST Jan 1
  ])("%s → %s", (instant, expected) => {
    expect(todayIST(new Date(instant))).toBe(expected);
  });
});

describe("istTimeHHMM", () => {
  it.each([
    ["2026-10-11T22:29:00Z", "03:59"],
    ["2026-10-11T18:30:00Z", "00:00"],
    ["2026-10-12T15:30:00Z", "21:00"],
    ["2026-10-12T16:00:00Z", "21:30"],
  ])("%s → %s", (instant, expected) => {
    expect(istTimeHHMM(new Date(instant))).toBe(expected);
  });
});

describe("isNightTime", () => {
  it.each([
    ["21:30", "21:30", "06:30", true],
    ["23:59", "21:30", "06:30", true],
    ["00:00", "21:30", "06:30", true],
    ["06:29", "21:30", "06:30", true],
    ["06:30", "21:30", "06:30", false],
    ["12:00", "21:30", "06:30", false],
    ["21:29", "21:30", "06:30", false],
    // ritual after midnight: no wrap
    ["01:00", "00:30", "06:30", true],
    ["00:10", "00:30", "06:30", false],
    ["07:00", "00:30", "06:30", false],
    // same time: never night
    ["21:30", "21:30", "21:30", false],
  ])("%s with ritual %s, wake %s → %s", (now, ritual, wake, expected) => {
    expect(isNightTime(now, ritual, wake)).toBe(expected);
  });
});

describe("addDays / daysBetween", () => {
  it.each([
    ["2026-10-31", 1, "2026-11-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-10-12", 0, "2026-10-12"],
    ["2026-10-12", 83, "2027-01-03"],
  ])("addDays(%s, %s) → %s", (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });

  it.each([
    ["2026-10-12", "2027-01-03", 83],
    ["2026-10-12", "2026-10-12", 0],
    ["2026-10-13", "2026-10-12", -1],
  ])("daysBetween(%s, %s) → %s", (a, b, expected) => {
    expect(daysBetween(a, b)).toBe(expected);
  });

  it("throws on malformed dates", () => {
    expect(() => addDays("2026-1-1", 1)).toThrow();
  });
});

describe("weekdayOf", () => {
  it.each([
    ["2026-10-11", 0],
    ["2026-10-12", 1],
    ["2026-10-17", 6],
  ])("%s → %s", (date, expected) => {
    expect(weekdayOf(date)).toBe(expected);
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-10-11", 2026, 41],
    ["2026-10-12", 2026, 42],
    ["2026-10-18", 2026, 42],
    ["2026-01-01", 2026, 1],
    ["2025-12-29", 2026, 1],
    ["2026-12-28", 2026, 53],
    ["2027-01-03", 2026, 53],
    ["2027-01-04", 2027, 1],
    ["2024-12-30", 2025, 1],
    ["2021-01-03", 2020, 53],
  ])("%s → %s-W%s", (date, year, week) => {
    expect(isoWeek(date)).toEqual({ year, week });
  });
});

describe("isoWeekRange", () => {
  it.each([
    [2026, 42, "2026-10-12", "2026-10-18"],
    [2026, 1, "2025-12-29", "2026-01-04"],
    [2026, 53, "2026-12-28", "2027-01-03"],
    [2025, 1, "2024-12-30", "2025-01-05"],
  ])("%s-W%s → %s..%s", (year, week, start, end) => {
    expect(isoWeekRange(year, week)).toEqual({ start, end });
  });

  it("round-trips with isoWeek", () => {
    for (let i = 0; i < 400; i += 3) {
      const date = addDays("2026-01-01", i);
      const { year, week } = isoWeek(date);
      const { start, end } = isoWeekRange(year, week);
      expect(date >= start && date <= end).toBe(true);
    }
  });
});

describe("formatIsoWeek / parseIsoWeek", () => {
  it("formats with zero padding", () => {
    expect(formatIsoWeek({ year: 2026, week: 5 })).toBe("2026-W05");
  });
  it.each<[string, { year: number; week: number } | null]>([
    ["2026-W42", { year: 2026, week: 42 }],
    ["2026W42", { year: 2026, week: 42 }],
    ["2026-W53", { year: 2026, week: 53 }],
    ["2025-W53", null],
    ["2026-W00", null],
    ["garbage", null],
  ])("parse %s", (value, expected) => {
    expect(parseIsoWeek(value)).toEqual(expected);
  });
});

describe("monthRange / monthOf", () => {
  it.each([
    ["2026-10", "2026-10-01", "2026-10-31"],
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["202402", "2024-02-01", "2024-02-29"],
    ["2026-12", "2026-12-01", "2026-12-31"],
  ])("%s → %s..%s", (yyyymm, start, end) => {
    expect(monthRange(yyyymm)).toEqual({ start, end });
  });

  it.each(["2026-13", "2026-00", "26-10", ""])("rejects %s", (bad) => {
    expect(() => monthRange(bad)).toThrow();
  });

  it("monthOf", () => {
    expect(monthOf("2026-10-11")).toBe("2026-10");
  });
});

describe("isIsoDate", () => {
  it.each([
    ["2026-02-28", true],
    ["2024-02-29", true],
    ["2026-02-30", false],
    ["2026-2-1", false],
    ["not a date", false],
  ])("%s → %s", (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });
});

describe("canEditScoring (even ISO week Sundays only)", () => {
  it.each([
    ["2026-10-18", true], // Sunday, W42
    ["2026-11-01", true], // Sunday, W44
    ["2026-10-11", false], // Sunday, W41 (odd)
    ["2026-10-25", false], // Sunday, W43 (odd)
    ["2026-10-17", false], // Saturday, W42
    ["2026-10-12", false], // Monday, W42
    ["2027-01-03", false], // Sunday, W53 (odd)
  ])("%s → %s", (date, expected) => {
    expect(canEditScoring(date)).toBe(expected);
  });
});
