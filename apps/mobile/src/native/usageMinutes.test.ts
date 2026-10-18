import { describe, expect, it } from "vitest";
import { dayWindow, foregroundMinutes, parseChosenApps, type UsageEvent } from "./usageMinutes";

const MIN = 60_000;
const fg = (pkg: string, m: number): UsageEvent => ({ pkg, kind: "fg", t: m * MIN });
const bg = (pkg: string, m: number): UsageEvent => ({ pkg, kind: "bg", t: m * MIN });

describe("dayWindow", () => {
  it("starts at 04:00 IST (22:30 UTC the evening before)", () => {
    const { start } = dayWindow("2026-10-18", Date.UTC(2026, 9, 18, 12));
    expect(new Date(start).toISOString()).toBe("2026-10-17T22:30:00.000Z");
  });

  it("ends now, or 24 hours after the start at most", () => {
    const now = Date.UTC(2026, 9, 18, 12);
    expect(dayWindow("2026-10-18", now).end).toBe(now);
    const later = Date.UTC(2026, 9, 20);
    const w = dayWindow("2026-10-18", later);
    expect(w.end - w.start).toBe(86_400_000);
  });

  it("never ends before it starts", () => {
    const w = dayWindow("2026-10-18", 0);
    expect(w.end).toBe(w.start);
  });
});

describe("foregroundMinutes", () => {
  it("sums open spans per app", () => {
    expect(foregroundMinutes([fg("a", 10), bg("a", 25), fg("b", 30), bg("b", 40)], 0, 100 * MIN)).toBe(25);
  });

  it("counts an app open at the start from the start", () => {
    expect(foregroundMinutes([bg("a", 15)], 5 * MIN, 100 * MIN)).toBe(10);
  });

  it("counts an app still open until the end", () => {
    expect(foregroundMinutes([fg("a", 90)], 0, 100 * MIN)).toBe(10);
  });

  it("ignores a repeated fg and a stray bg", () => {
    expect(foregroundMinutes([fg("a", 0), fg("a", 5), bg("a", 10), bg("a", 20)], 0, 100 * MIN)).toBe(10);
  });

  it("sorts events and clamps them to the window", () => {
    expect(foregroundMinutes([bg("a", 30), fg("a", -10)], 0, 20 * MIN)).toBe(20);
  });

  it("is zero with no events", () => {
    expect(foregroundMinutes([], 0, 100 * MIN)).toBe(0);
  });
});

describe("parseChosenApps", () => {
  it.each([
    [null, []],
    ["", []],
    ["not json", []],
    ['{"a":1}', []],
    ['["com.a","com.a",3,"","com.b"]', ["com.a", "com.b"]],
  ])("%j → %j", (raw, expected) => {
    expect(parseChosenApps(raw)).toEqual(expected);
  });
});
