import { describe, expect, it } from "vitest";
import { MAX_PER_DAY, ignoredInARow, istInstant, planReminders, type DayInput, type PlanInput } from "./plan";

const day = (date: string, over: Partial<DayInput> = {}): DayInput => ({
  date,
  kind: "normal",
  p1Title: "Terraform module",
  p1Open: true,
  p1Started: false,
  closed: false,
  ...over,
});

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  // 2026-10-19 05:00 IST
  now: new Date("2026-10-18T23:30:00Z"),
  wake: "06:30",
  ritual: "21:30",
  afternoon: { enabled: true, time: "14:00" },
  days: [day("2026-10-19"), day("2026-10-20", { p1Title: null, p1Open: false })],
  ...over,
});

describe("istInstant", () => {
  it.each([
    ["2026-10-19", "06:30", "2026-10-19T01:00:00.000Z"],
    ["2026-10-19", "21:30", "2026-10-19T16:00:00.000Z"],
    // before 04:00 IST belongs to the next calendar date of the same app day
    ["2026-10-19", "00:30", "2026-10-19T19:00:00.000Z"],
  ])("%s %s IST → %s", (date, hhmm, iso) => {
    expect(istInstant(date, hhmm).toISOString()).toBe(iso);
  });
});

describe("planReminders", () => {
  it("plans morning, afternoon and ritual today, and morning + ritual tomorrow", () => {
    const r = planReminders(base());
    expect(r.map((x) => x.key)).toEqual([
      "2026-10-19:morning",
      "2026-10-19:afternoon",
      "2026-10-19:ritual",
      "2026-10-20:morning",
      "2026-10-20:ritual",
    ]);
    expect(r[0]?.title).toBe("P1: Terraform module. Start?");
    expect(r[3]?.title).toBe("Good morning");
  });

  it("never plans more than three for one day", () => {
    const perDay = new Map<string, number>();
    for (const x of planReminders(base())) perDay.set(x.date, (perDay.get(x.date) ?? 0) + 1);
    for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(MAX_PER_DAY);
  });

  it("drops reminders whose time has passed", () => {
    // 2026-10-19 15:00 IST
    const r = planReminders(base({ now: new Date("2026-10-19T09:30:00Z") }));
    expect(r.map((x) => x.key)).toEqual(["2026-10-19:ritual", "2026-10-20:morning", "2026-10-20:ritual"]);
  });

  it("skips the afternoon nudge when P1 started, is done, or the nudge is off", () => {
    expect(planReminders(base({ days: [day("2026-10-19", { p1Started: true })] })).some((x) => x.kind === "afternoon")).toBe(false);
    expect(planReminders(base({ days: [day("2026-10-19", { p1Open: false })] })).some((x) => x.kind === "afternoon")).toBe(false);
    expect(planReminders(base({ afternoon: { enabled: false, time: "14:00" } })).some((x) => x.kind === "afternoon")).toBe(false);
  });

  it("skips the ritual reminder once the day is closed, and everything on rest / write-off days", () => {
    expect(planReminders(base({ days: [day("2026-10-19", { closed: true })] })).some((x) => x.kind === "ritual")).toBe(false);
    expect(planReminders(base({ days: [day("2026-10-19", { kind: "rest" }), day("2026-10-20", { kind: "write_off" })] }))).toEqual([]);
  });
});

describe("ignoredInARow", () => {
  const fired = [
    { key: "a", at: 1 },
    { key: "b", at: 2 },
    { key: "c", at: 3 },
  ];
  it("counts the newest unopened reminders until one was opened", () => {
    expect(ignoredInARow(fired, new Set(["a"]), 10)).toBe(2);
    expect(ignoredInARow(fired, new Set(["c"]), 10)).toBe(0);
    expect(ignoredInARow(fired, new Set(), 10)).toBe(3);
  });
  it("ignores reminders that have not fired yet", () => {
    expect(ignoredInARow(fired, new Set(), 2)).toBe(2);
  });
});
