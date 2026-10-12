import { describe, expect, it } from "vitest";
import {
  elapsedMs,
  focusedMinutes,
  formatClock,
  isFinished,
  newSession,
  parseSession,
  pause,
  progress,
  remainingMs,
  resume,
  spokenRemaining,
} from "./timer";

const MIN = 60_000;
const T0 = 1_760_000_000_000;

describe("focus timer", () => {
  it("counts down from the start time", () => {
    const s = newSession("m1", 25, T0);
    expect(remainingMs(s, T0)).toBe(25 * MIN);
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(progress(s, T0 + 5 * MIN)).toBeCloseTo(0.2);
  });

  it("never goes below zero or above the length", () => {
    const s = newSession("m1", 25, T0);
    expect(remainingMs(s, T0 + 90 * MIN)).toBe(0);
    expect(elapsedMs(s, T0 + 90 * MIN)).toBe(25 * MIN);
    expect(elapsedMs(s, T0 - 5 * MIN)).toBe(0); // clock moved backwards
    expect(isFinished(s, T0 + 25 * MIN)).toBe(true);
    expect(isFinished(s, T0 + 25 * MIN - 1)).toBe(false);
  });

  it("freezes while paused and excludes the pause after resume", () => {
    let s = newSession("m1", 50, T0);
    s = pause(s, T0 + 10 * MIN);
    expect(remainingMs(s, T0 + 30 * MIN)).toBe(40 * MIN);
    s = resume(s, T0 + 30 * MIN);
    expect(s.pausedMs).toBe(20 * MIN);
    expect(s.pausedAt).toBeNull();
    expect(remainingMs(s, T0 + 35 * MIN)).toBe(35 * MIN);
  });

  it("pause and resume are idempotent", () => {
    const s = newSession("m1", 25, T0);
    const p = pause(s, T0 + MIN);
    expect(pause(p, T0 + 2 * MIN)).toBe(p);
    expect(resume(s, T0 + MIN)).toBe(s);
  });

  it("rounds focused minutes", () => {
    const s = newSession("m1", 50, T0);
    expect(focusedMinutes(s, T0 + 12 * MIN + 29_000)).toBe(12);
    expect(focusedMinutes(s, T0 + 12 * MIN + 31_000)).toBe(13);
  });

  it("formats the clock with seconds rounded up", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(1_000)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
    expect(formatClock(90 * MIN)).toBe("1:30:00");
  });

  it("speaks the remaining time calmly", () => {
    expect(spokenRemaining(12 * MIN)).toBe("12 minutes left");
    expect(spokenRemaining(30_000)).toBe("Less than a minute left");
    expect(spokenRemaining(0)).toBe("Time is up");
  });

  it("parses stored sessions defensively", () => {
    const s = newSession("m1", 5, T0);
    expect(parseSession(JSON.stringify(s))).toEqual(s);
    expect(parseSession(null)).toBeNull();
    expect(parseSession("not json")).toBeNull();
    expect(parseSession(JSON.stringify({ missionId: "", length: 25, startedAt: T0 }))).toBeNull();
    expect(parseSession(JSON.stringify({ missionId: "m", length: 0, startedAt: T0 }))).toBeNull();
    expect(parseSession(JSON.stringify({ missionId: "m", length: 25, startedAt: T0 }))).toEqual({
      missionId: "m",
      length: 25,
      startedAt: T0,
      pausedMs: 0,
      pausedAt: null,
    });
  });
});
