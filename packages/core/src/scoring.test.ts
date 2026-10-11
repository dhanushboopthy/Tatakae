import { describe, it } from "vitest";

// TODO(v1): table-driven tests for every rule in docs/02-method.md (Scoring).
describe("scoring", () => {
  it.todo("blank points count as 1");
  it.todo("rescheduled and backlog are excluded from planned");
  it.todo("minimum earns half points");
  it.todo("exec is 0 when nothing planned and mark is Unplanned");
  it.todo("screen 120 → 0, 149 → 0, 150 → -5, 240 → -20, 600 → -20 (cap)");
  it.todo("comeback bonus +10 only when yesterday missed and P1 done/minimum");
  it.todo("final is clamped to 0..100");
  it.todo("marks: >=80 Strong, >=50 Solid, else Light");
  it.todo("missed day when exec < 25 or nothing planned");
  it.todo("rest and write_off days are excluded");
  it.todo("daysShownUp never decreases");
});
