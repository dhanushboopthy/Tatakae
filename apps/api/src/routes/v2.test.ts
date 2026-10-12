import { describe, expect, it } from "vitest";
import { call, setup } from "../test/helpers";

type Json = Record<string, unknown>;

const goal = (name: string, over: Json = {}) => ({ name, status: "active", hellYeah: true, ...over });

describe("goals", () => {
  it("CRUD with the hell-yeah gate and the 4-active limit", async () => {
    const { app } = await setup();
    expect((await call(app, "POST", "/goals", goal("No gate", { hellYeah: false }))).status).toBe(400);
    for (const n of ["A", "B", "C", "D"]) expect((await call(app, "POST", "/goals", goal(n))).status).toBe(201);
    const fifth = await call(app, "POST", "/goals", goal("E"));
    expect(fifth.status).toBe(409);
    expect(fifth.body["error"]).toBe("too_many_goals");
    const paused = await call(app, "POST", "/goals", goal("E", { status: "paused", targetPoints: 20 }));
    expect(paused.status).toBe(201);
    const id = String((paused.body["item"] as Json)["id"]);
    expect((paused.body["item"] as Json)["targetPoints"]).toBe(20);
    expect((await call(app, "PATCH", `/goals/${id}`, { status: "active" })).status).toBe(409);
    const list = await call(app, "GET", "/goals");
    expect((list.body["items"] as Json[]).map((g) => g["name"])).toEqual(["A", "B", "C", "D", "E"]);
    expect((await call(app, "DELETE", `/goals/${id}`)).status).toBe(200);
    expect((await call(app, "GET", `/goals/${id}`)).status).toBe(404);
  });

  it("the limit also holds through sync", async () => {
    const { app } = await setup();
    for (const n of ["A", "B", "C", "D"]) await call(app, "POST", "/goals", goal(n));
    const row = {
      id: "01JSYNCGOAL00000000000000E",
      name: "E",
      areaId: null,
      status: "active",
      intent: null,
      outcome: null,
      niceGoal: null,
      nextAction: null,
      why: null,
      hellYeah: true,
      start: null,
      end: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    const res = await call(app, "POST", "/sync", {
      client: "web",
      cursor: null,
      items: [{ id: "item-1", table: "goals", op: "upsert", row, updatedAt: row.updatedAt }],
    });
    expect(res.body["conflicts"]).toEqual([{ id: "item-1", server: null }]);
  });
});

describe("areas, experiments, stuck", () => {
  it("areas keep colour and icon", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/areas", { name: "Career", color: "sage", icon: "Server" });
    expect(res.status).toBe(201);
    expect(res.body["item"]).toMatchObject({ name: "Career", color: "sage", icon: "Server" });
    expect((await call(app, "POST", "/areas", { name: "X", color: "red" })).status).toBe(400);
  });

  it("one running experiment at a time", async () => {
    const { app } = await setup();
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10);
    const first = await call(app, "POST", "/experiments", { hypothesis: "Phone outside → better sleep", change: "Charger in the hall", start: today, end });
    expect(first.status).toBe(201);
    const second = await call(app, "POST", "/experiments", { hypothesis: "h", change: "c", start: today, end });
    expect(second.status).toBe(409);
    const id = String((first.body["item"] as Json)["id"]);
    expect((await call(app, "PATCH", `/experiments/${id}`, { decision: "Keep it" })).status).toBe(200);
    expect((await call(app, "POST", "/experiments", { hypothesis: "h", change: "c", start: today, end })).status).toBe(201);
    expect((await call(app, "POST", "/experiments", { hypothesis: "h", change: "c", start: end, end: today })).status).toBe(400);
  });

  it("stuck events are logged and listed", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/stuck", { missionId: "m1", blocker: "fear", unblocker: null });
    expect(res.status).toBe(201);
    expect((await call(app, "GET", "/stuck")).body["items"]).toHaveLength(1);
  });
});

describe("reviews and story", () => {
  const review = (periodStart: string) => ({
    type: "week",
    periodStart,
    periodEnd: periodStart,
    wins: "Shipped the module",
    failed: null,
    why: null,
    muri: null,
    mura: null,
    muda: null,
    diagnosis: null,
    bottleneck: null,
    capacity: null,
    burnout: null,
    capability: null,
    theme: null,
  });

  it("a weekly review unlocks one reward episode; duplicates are refused", async () => {
    const { app } = await setup();
    expect((await call(app, "POST", "/story/watch", { title: "Frieren", totalEpisodes: 28 })).status).toBe(201);
    expect((await call(app, "POST", "/reviews", review("2026-10-19"))).status).toBe(201);
    expect((await call(app, "POST", "/reviews", review("2026-10-19"))).status).toBe(409);
    const q = await call(app, "GET", "/story/watch");
    expect((q.body["items"] as Json[])[0]).toMatchObject({ title: "Frieren", unlocked: 1, status: "watching" });
    expect((await call(app, "PATCH", "/story/watch/Frieren", { watched: 1 })).status).toBe(200);
    expect((await call(app, "DELETE", "/story/watch/Frieren")).status).toBe(200);
    expect((await call(app, "DELETE", "/story/watch/Frieren")).status).toBe(404);
  });

  it("imports a pack, rejects quotes over 160 chars, mutes, and picks", async () => {
    const { app } = await setup();
    const ref = { title: "Vinland Saga", medium: "anime", character: "Thorfinn", lesson: "You have no enemies; the work is the fight.", moment: "p1_done", yourLine: null };
    const ok = await call(app, "POST", "/story/import", { version: 1, refs: [ref, ref] });
    expect(ok.body).toEqual({ added: 1, skipped: 1 });
    expect((await call(app, "POST", "/story/import", { version: 1, refs: [{ ...ref, lesson: "x".repeat(161) }] })).status).toBe(400);
    const list = await call(app, "GET", "/story");
    const id = String(((list.body["items"] as Json[])[0] as Json)["id"]);
    expect((await call(app, "GET", "/story/next?moment=nope")).status).toBe(400);
    const next = await call(app, "GET", "/story/next?moment=p1_done");
    expect(next.status).toBe(200);
    expect("story" in next.body).toBe(true);
    expect((await call(app, "PATCH", `/story/${id}`, { muted: true })).body["item"]).toMatchObject({ muted: true });
  });
});
