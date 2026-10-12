import { describe, expect, it } from "vitest";
import { STORY_CHANCE, pickScene, pickStory, recentlyShownIds, rewardTarget, themeFor, type PickableStory } from "./story";

const ref = (id: string, moment: PickableStory["moment"], muted = false, deletedAt: string | null = null): PickableStory => ({
  id,
  moment,
  muted,
  deletedAt,
});

/** rand() that returns the given values in order (then repeats the last). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
};

const refs = [
  ref("a", "p1_done"),
  ref("b", "p1_done"),
  ref("c", "p1_done", true), // muted
  ref("d", "comeback"),
  ref("e", "p1_done", false, "2026-10-01T00:00:00Z"), // deleted
];

describe("pickStory", () => {
  it.each<[string, number[], string[], string | null]>([
    ["roll fails (≥ 1/3) → null", [STORY_CHANCE], [], null],
    ["roll passes, first eligible", [0, 0], [], "a"],
    ["roll passes, last eligible", [0.1, 0.99], [], "b"],
    ["recently shown is skipped", [0, 0], ["a"], "b"],
    ["all eligible recently shown → null", [0, 0], ["a", "b"], null],
  ])("%s", (_name, rolls, recent, expected) => {
    expect(pickStory(refs, "p1_done", recent, seq(...rolls))?.id ?? null).toBe(expected);
  });

  it("never picks muted or deleted refs", () => {
    for (let r = 0; r < 1; r += 0.05) {
      const picked = pickStory(refs, "p1_done", [], seq(0, r));
      expect(["a", "b"]).toContain(picked?.id);
    }
  });

  it("matches the moment only", () => {
    expect(pickStory(refs, "comeback", [], seq(0, 0.5))?.id).toBe("d");
    expect(pickStory(refs, "rest_day", [], seq(0, 0.5))).toBeNull();
  });

  it("shows roughly 1 in 3 with Math.random", () => {
    let shown = 0;
    for (let i = 0; i < 3000; i++) if (pickStory(refs, "p1_done", [])) shown++;
    expect(shown / 3000).toBeGreaterThan(0.28);
    expect(shown / 3000).toBeLessThan(0.39);
  });
});

describe("recentlyShownIds", () => {
  it("returns ids shown within the last 14 days", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(
      recentlyShownIds(
        [
          { id: "fresh", lastShownAt: "2026-10-19T12:00:00Z" },
          { id: "edge", lastShownAt: "2026-10-06T12:00:01Z" },
          { id: "old", lastShownAt: "2026-10-01T12:00:00Z" },
          { id: "never", lastShownAt: null },
        ],
        now,
      ),
    ).toEqual(["fresh", "edge"]);
  });
});

describe("themeFor", () => {
  it.each([
    ["2026-10-20", "Terraform"],
    ["2026-11-02", "Kubernetes"],
    ["2026-12-31", "AWS SAA"],
    ["2027-01-01", null],
  ])("%s → %s", (date, expected) => {
    expect(themeFor(date)).toBe(expected);
  });
});

describe("rewardTarget", () => {
  const w = (title: string, status: "queued" | "watching" | "done" | "dropped", unlocked: number, total: number | null, updatedAt = "2026-10-01T00:00:00.000Z") => ({
    title,
    status,
    unlocked,
    totalEpisodes: total,
    updatedAt,
    deletedAt: null,
  });
  it("prefers the show being watched while episodes are left", () => {
    expect(rewardTarget([w("A", "queued", 0, 12), w("B", "watching", 3, 12)])?.title).toBe("B");
  });
  it("falls back to the oldest queued show", () => {
    expect(
      rewardTarget([w("A", "watching", 12, 12), w("C", "queued", 0, null, "2026-10-03T00:00:00.000Z"), w("D", "queued", 0, 5, "2026-10-02T00:00:00.000Z")])?.title,
    ).toBe("D");
  });
  it("is null when nothing can be unlocked", () => {
    expect(rewardTarget([w("A", "done", 5, 5), w("B", "dropped", 0, 4)])).toBeNull();
  });
});

describe("pickScene", () => {
  const pool = ["k", "c", "h", "a", "f", "i", "b", "e", "g", "j"].map((id) => ref(id, "weekly_review"));

  it("only picks live, unmuted refs of the scene's moments", () => {
    expect(pickScene(refs, "welcome_back", "2026-10-12")?.id).toBe("d");
    expect(["a", "b"]).toContain(pickScene(refs, "today", "2026-10-12")?.id);
    expect(pickScene(refs, "shutdown", "2026-10-12")).toBeNull(); // no rest_day refs
  });

  it("is stable for a day whatever the input order", () => {
    const first = pickScene(pool, "weekly", "2026-10-12");
    expect(pickScene([...pool].reverse(), "weekly", "2026-10-12")).toEqual(first);
  });

  it("rotates across days", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    expect(new Set(week.map((d) => pickScene(pool, "weekly", d)?.id)).size).toBeGreaterThan(2);
  });
});
