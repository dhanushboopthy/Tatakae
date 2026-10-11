import { afterEach, describe, expect, it, vi } from "vitest";
import { allRows } from "../lib/rows.service";
import { call, setup } from "../test/helpers";

type Json = Record<string, unknown>;

const P1 = {
  title: "Terraform module",
  dayDate: "2026-10-20",
  slot: "P1",
  minimum: "Write variables.tf",
  ifThen: "If it is 19:00, then I open the editor",
};

async function createMission(app: Awaited<ReturnType<typeof setup>>["app"], body: Json) {
  const res = await call(app, "POST", "/missions", body);
  expect(res.status).toBe(201);
  return res.body["mission"] as Json;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("days routes", () => {
  it("GET synthesises an unsaved day with an Unplanned score", async () => {
    const { app } = await setup();
    const res = await call(app, "GET", "/days/2026-10-20");
    expect(res.status).toBe(200);
    expect(res.body["day"]).toMatchObject({ date: "2026-10-20", kind: "normal", forgedAt: null });
    expect(res.body["missions"]).toEqual([]);
    expect(res.body["score"]).toMatchObject({ planned: 0, final: 0, mark: "Unplanned" });
    expect(res.body["firstUseDate"]).toBeNull();
  });

  it("GET rejects a malformed date", async () => {
    const { app } = await setup();
    expect((await call(app, "GET", "/days/2026-13-40")).status).toBe(400);
  });

  it("GET returns day, missions and score", async () => {
    const { app } = await setup();
    const p1 = await createMission(app, P1);
    const p2 = await createMission(app, { title: "Read chapter", dayDate: "2026-10-20", slot: "P2" });
    await createMission(app, { title: "Stretch", dayDate: "2026-10-20", slot: "P3" });
    expect((await call(app, "PATCH", `/missions/${String(p1["id"])}`, { status: "done" })).status).toBe(200);
    expect((await call(app, "PATCH", `/missions/${String(p2["id"])}`, { status: "minimum" })).status).toBe(200);
    expect((await call(app, "PUT", "/days/2026-10-20", { screenMin: 160 })).status).toBe(200);

    const res = await call(app, "GET", "/days/2026-10-20");
    expect(res.status).toBe(200);
    const ms = res.body["missions"] as Json[];
    expect(ms.map((m) => m["slot"])).toEqual(["P1", "P2", "P3"]);
    // Method example: 3 planned, 1.5 earned, 160 min screen → 50 − 5 = 45, Light.
    expect(res.body["score"]).toMatchObject({ planned: 3, earned: 1.5, exec: 50, penalty: -5, final: 45, mark: "Light" });
    expect(res.body["day"]).toMatchObject({ screenMin: 160 });
    expect(res.body["firstUseDate"]).toBe("2026-10-20");
  });

  it("applies the comeback bonus after a missed day", async () => {
    const { app } = await setup();
    // 19 Oct saved with nothing planned → missed day.
    expect((await call(app, "PUT", "/days/2026-10-19", { intention: "start" })).status).toBe(200);
    const p1 = await createMission(app, P1);
    await call(app, "PATCH", `/missions/${String(p1["id"])}`, { status: "minimum" });
    const res = await call(app, "GET", "/days/2026-10-20");
    expect(res.body["yesterdayMissed"]).toBe(true);
    expect(res.body["score"]).toMatchObject({ exec: 50, bonus: 10, final: 60, mark: "Solid" });
  });

  it("forge rejects P1 without minimum/ifThen", async () => {
    const { app } = await setup();
    await createMission(app, { ...P1, minimum: null, ifThen: null });
    const res = await call(app, "POST", "/days/2026-10-20/forge");
    expect(res.status).toBe(400);
    expect(res.body["error"]).toBe("forge_invalid");
    expect((res.body["detail"] as Json)["problems"]).toEqual(["p1_missing_minimum", "p1_missing_if_then"]);
  });

  it("forge rejects a day without a P1", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/days/2026-10-20/forge");
    expect(res.status).toBe(400);
    expect((res.body["detail"] as Json)["problems"]).toEqual(["no_p1"]);
  });

  it("forge locks the plan with server time and is idempotent", async () => {
    const { app } = await setup();
    await createMission(app, P1);
    const res = await call(app, "POST", "/days/2026-10-20/forge");
    expect(res.status).toBe(200);
    const forgedAt = (res.body["day"] as Json)["forgedAt"];
    expect(typeof forgedAt).toBe("string");
    const again = await call(app, "POST", "/days/2026-10-20/forge");
    expect((again.body["day"] as Json)["forgedAt"]).toBe(forgedAt);
  });

  it("PUT never sets forgedAt", async () => {
    const { app } = await setup();
    const res = await call(app, "PUT", "/days/2026-10-20", { forgedAt: "2026-10-19T00:00:00.000Z", smallWin: "shipped" });
    expect(res.status).toBe(200);
    expect(res.body["day"]).toMatchObject({ forgedAt: null, smallWin: "shipped" });
  });

  it("write-off needs a reason", async () => {
    const { app } = await setup();
    const res = await call(app, "PUT", "/days/2026-10-20", { kind: "write_off" });
    expect(res.status).toBe(400);
    expect(res.body["error"]).toBe("write_off_reason");
  });

  it("third write-off in a month is rejected", async () => {
    const { app } = await setup();
    const wo = (date: string) => call(app, "PUT", `/days/${date}`, { kind: "write_off", reason: "fever" });
    expect((await wo("2026-10-05")).status).toBe(200);
    expect((await wo("2026-10-06")).status).toBe(200);
    const third = await wo("2026-10-07");
    expect(third.status).toBe(400);
    expect(third.body["error"]).toBe("write_off_limit");
    // Re-saving an existing write-off is fine; another month has its own budget.
    expect((await wo("2026-10-05")).status).toBe(200);
    expect((await wo("2026-11-02")).status).toBe(200);
    const saved = await call(app, "GET", "/days/2026-10-05");
    expect(saved.body["day"]).toMatchObject({ kind: "write_off", qDrift: "fever" });
  });
});

describe("missions routes (plan lock)", () => {
  async function forgedDay() {
    const ctx = await setup();
    const p1 = await createMission(ctx.app, P1);
    const p2 = await createMission(ctx.app, { title: "Read", dayDate: "2026-10-20", slot: "P2" });
    expect((await call(ctx.app, "POST", "/days/2026-10-20/forge")).status).toBe(200);
    return { ...ctx, p1Id: String(p1["id"]), p2Id: String(p2["id"]) };
  }

  it("PATCH on forged mission without reason returns 423", async () => {
    const { app, p1Id } = await forgedDay();
    const res = await call(app, "PATCH", `/missions/${p1Id}`, { title: "Something else" });
    expect(res.status).toBe(423);
    expect(res.body["error"]).toBe("plan_locked");
  });

  it("free fields stay editable on a forged day", async () => {
    const { app, p1Id } = await forgedDay();
    const res = await call(app, "PATCH", `/missions/${p1Id}`, { status: "done", actualMin: 45, resumeNote: "next: outputs" });
    expect(res.status).toBe(200);
    expect(res.body["mission"]).toMatchObject({ status: "done", actualMin: 45 });
  });

  it("edit-locked applies the patch and records a mura event", async () => {
    const { app, db, p1Id } = await forgedDay();
    const res = await call(app, "POST", `/missions/${p1Id}/edit-locked`, { reason: "client call moved", patch: { title: "Smaller module" } });
    expect(res.status).toBe(200);
    expect(res.body["mission"]).toMatchObject({ title: "Smaller module" });
    expect(res.body["muraEvent"]).toMatchObject({ missionId: p1Id, reason: "client call moved" });
    expect(allRows(db, "mura_events")).toHaveLength(1);
  });

  it("creating a mission on a forged day needs a reason", async () => {
    const { app, db } = await forgedDay();
    const body = { title: "Extra", dayDate: "2026-10-20", slot: "side" };
    expect((await call(app, "POST", "/missions", body)).status).toBe(423);
    const ok = await call(app, "POST", "/missions", { ...body, reason: "urgent bug" });
    expect(ok.status).toBe(201);
    expect(allRows(db, "mura_events")).toHaveLength(1);
  });

  it("deleting needs a reason on a forged day and is a soft delete", async () => {
    const { app, p2Id } = await forgedDay();
    expect((await call(app, "DELETE", `/missions/${p2Id}`)).status).toBe(423);
    const res = await call(app, "DELETE", `/missions/${p2Id}?reason=${encodeURIComponent("not needed")}`);
    expect(res.status).toBe(200);
    const m = res.body["mission"] as Json;
    expect(m["deletedAt"]).toBe(m["updatedAt"]);
    const list = await call(app, "GET", "/missions?date=2026-10-20");
    expect((list.body["missions"] as Json[]).map((x) => x["id"])).not.toContain(p2Id);
  });

  it("unforged days are freely editable", async () => {
    const { app } = await setup();
    const p1 = await createMission(app, P1);
    const res = await call(app, "PATCH", `/missions/${String(p1["id"])}`, { title: "Renamed", slot: "P2" });
    expect(res.status).toBe(200);
  });

  it("reschedule marks the original and creates a backlog copy", async () => {
    const { app, p2Id } = await forgedDay();
    const res = await call(app, "POST", `/missions/${p2Id}/reschedule`);
    expect(res.status).toBe(200);
    expect(res.body["mission"]).toMatchObject({ id: p2Id, status: "rescheduled", rescheduleCount: 1 });
    expect(res.body["backlog"]).toMatchObject({ dayDate: null, slot: "backlog", status: "backlog", rescheduleCount: 1 });
    const backlog = await call(app, "GET", "/missions?backlog=1");
    expect(backlog.body["missions"]).toHaveLength(1);
    expect((await call(app, "POST", `/missions/${p2Id}/reschedule`)).status).toBe(409);
  });

  it("GET /missions needs a date or backlog flag", async () => {
    const { app } = await setup();
    expect((await call(app, "GET", "/missions")).status).toBe(400);
  });
});

describe("settings routes", () => {
  it("GET returns resolved defaults", async () => {
    const { app } = await setup();
    const res = await call(app, "GET", "/settings");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ wake_time: "06:30", ritual_time: "21:30", focus_default: 50 });
    expect(res.body["scoring"]).toMatchObject({ writeOffsPerMonth: 2, strongAt: 80 });
  });

  it("PUT validates per key", async () => {
    const { app } = await setup();
    expect((await call(app, "PUT", "/settings/wake_time", { value: "6:30am" })).status).toBe(400);
    expect((await call(app, "PUT", "/settings/nope", { value: 1 })).status).toBe(404);
    const ok = await call(app, "PUT", "/settings/wake_time", { value: "07:00" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ key: "wake_time", value: "07:00" });
  });

  it("scoring is locked except on even-week Sundays", async () => {
    const { app } = await setup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T10:00:00+05:30")); // Sunday, ISO week 43
    const locked = await call(app, "PUT", "/settings/scoring", { value: { strongAt: 85 } });
    expect(locked.status).toBe(423);

    vi.setSystemTime(new Date("2026-10-18T10:00:00+05:30")); // Sunday, ISO week 42
    const ok = await call(app, "PUT", "/settings/scoring", { value: { strongAt: 85 } });
    expect(ok.status).toBe(200);
    // Partial value merged over the stored one.
    expect(ok.body["value"]).toMatchObject({ strongAt: 85, solidAt: 50, writeOffsPerMonth: 2 });
  });
});

describe("habits and inbox routes", () => {
  it("logs a habit for a date", async () => {
    const { app } = await setup();
    const created = await call(app, "POST", "/habits", { behaviour: "Anki 10 cards", anchor: "After coffee" });
    expect(created.status).toBe(201);
    const id = String((created.body["habit"] as Json)["id"]);
    const log = await call(app, "PUT", `/habits/${id}/logs/2026-10-20`, { done: true });
    expect(log.status).toBe(200);
    expect(log.body["log"]).toMatchObject({ habitId: id, date: "2026-10-20", done: true });
    const list = await call(app, "GET", "/habits?date=2026-10-20");
    expect(list.body["logs"]).toHaveLength(1);
    expect((await call(app, "PUT", "/habits/missing/logs/2026-10-20", { done: true })).status).toBe(404);
  });

  it("processes an inbox item into a backlog mission", async () => {
    const { app } = await setup();
    const created = await call(app, "POST", "/inbox", { text: "Look into Litestream restore drill" });
    expect(created.status).toBe(201);
    const id = String((created.body["item"] as Json)["id"]);
    const res = await call(app, "PATCH", `/inbox/${id}`, { to: "mission" });
    expect(res.status).toBe(200);
    expect(res.body["mission"]).toMatchObject({ title: "Look into Litestream restore drill", dayDate: null, slot: "backlog", status: "backlog" });
    expect(res.body["item"]).toMatchObject({ processed: true });
    expect((await call(app, "GET", "/inbox")).body["items"]).toEqual([]);
  });

  it("discards an inbox item", async () => {
    const { app } = await setup();
    const created = await call(app, "POST", "/inbox", { text: "random thought" });
    const id = String((created.body["item"] as Json)["id"]);
    const res = await call(app, "PATCH", `/inbox/${id}`, { to: "discard" });
    expect(res.status).toBe(200);
    expect((res.body["item"] as Json)["deletedAt"]).not.toBeNull();
  });
});
