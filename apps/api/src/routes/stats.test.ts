import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, setup } from "../test/helpers";

type Json = Record<string, unknown>;

// "Now" = Thu 22 Oct 2026, 12:00 IST.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T06:30:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function doneDay(app: Awaited<ReturnType<typeof setup>>["app"], date: string, screenMin: number | null = null) {
  const created = await call(app, "POST", "/missions", {
    title: `P1 ${date}`,
    dayDate: date,
    slot: "P1",
    minimum: "min",
    ifThen: "if then",
  });
  expect(created.status).toBe(201);
  const id = String((created.body["mission"] as Json)["id"]);
  expect((await call(app, "PATCH", `/missions/${id}`, { status: "done" })).status).toBe(200);
  if (screenMin != null) expect((await call(app, "PUT", `/days/${date}`, { screenMin })).status).toBe(200);
}

describe("stats routes", () => {
  it("scoreboard returns every box", async () => {
    const { app } = await setup();
    await doneDay(app, "2026-10-20", 90);
    await doneDay(app, "2026-10-21", 150);
    const res = await call(app, "GET", "/stats/scoreboard");
    expect(res.status).toBe(200);
    expect(res.body["date"]).toBe("2026-10-22");
    const boxes = res.body["boxes"] as Json[];
    const by = Object.fromEntries(boxes.map((b) => [String(b["key"]), b]));
    expect(by["days_shown_up"]?.["value"]).toBe(2);
    expect(by["avg_7d"]?.["value"]).toBe(98); // 100 and 95
    expect(by["screen_avg"]?.["value"]).toBe(120);
    expect(by["focus_week"]?.["target"]).toBe(600);
  });

  it("calendar returns the month and rejects a bad month", async () => {
    const { app } = await setup();
    await doneDay(app, "2026-10-20", 0); // saves the day row → first use
    const res = await call(app, "GET", "/stats/calendar/2026-10");
    expect(res.status).toBe(200);
    const days = res.body["days"] as Json[];
    expect(days).toHaveLength(31);
    expect(days[19]).toMatchObject({ date: "2026-10-20", state: "Strong", final: 100, done: 1 });
    expect(days[20]).toMatchObject({ date: "2026-10-21", state: "Missed" });
    expect(days[21]).toMatchObject({ date: "2026-10-22", state: "Today" });
    expect((await call(app, "GET", "/stats/calendar/2026-13")).status).toBe(400);
  });

  it("series, week, month, cycle, habits and focus-hours answer", async () => {
    const { app } = await setup();
    await doneDay(app, "2026-10-20", 200);
    const s = await call(app, "GET", "/stats/series?metric=screen_min&days=3");
    expect(s.status).toBe(200);
    expect((s.body["points"] as Json[]).map((p) => p["value"])).toEqual([200, null, null]);
    expect((await call(app, "GET", "/stats/series?metric=nope")).status).toBe(400);

    const w = await call(app, "GET", "/stats/week/2026-W43");
    expect(w.status).toBe(200);
    expect(w.body["start"]).toBe("2026-10-19");
    expect((await call(app, "GET", "/stats/week/2026-W99")).status).toBe(400);

    const m = await call(app, "GET", "/stats/month/202610");
    expect(m.status).toBe(200);
    expect(m.body["marks"]).toMatchObject({ Strong: 1, Missed: 1 }); // 20th: 100 − 10 (200 min) = 90; 21st grey
    const cyc = await call(app, "GET", "/stats/cycle");
    expect(cyc.status).toBe(200);
    expect(cyc.body["weeks"]).toHaveLength(12);
    expect((await call(app, "GET", "/stats/habits?days=7")).status).toBe(200);
    expect((await call(app, "GET", "/stats/focus-hours")).status).toBe(200);
  });
});

describe("focus routes", () => {
  it("starts, ends, lists and deletes a session; it syncs", async () => {
    const { app } = await setup();
    const created = await call(app, "POST", "/focus", { plannedMin: 25, missionId: null });
    expect(created.status).toBe(201);
    const session = created.body["session"] as Json;
    expect(session).toMatchObject({ plannedMin: 25, completed: false, endedAt: null, startedAt: "2026-10-22T06:30:00.000Z" });
    const id = String(session["id"]);

    const ended = await call(app, "PATCH", `/focus/${id}`, { endedAt: "2026-10-22T06:55:00.000Z", completed: true });
    expect(ended.status).toBe(200);
    expect(ended.body["session"]).toMatchObject({ completed: true });

    const list = await call(app, "GET", "/focus?from=2026-10-22&to=2026-10-22");
    expect(list.body["sessions"]).toHaveLength(1);
    expect((await call(app, "GET", "/focus?from=2026-10-23")).body["sessions"]).toHaveLength(0);

    const board = await call(app, "GET", "/stats/scoreboard");
    const focusBox = (board.body["boxes"] as Json[]).find((b) => b["key"] === "focus_week");
    expect(focusBox?.["value"]).toBe(25);

    const pulled = await call(app, "POST", "/sync", { client: "web", cursor: null, items: [] });
    const changes = pulled.body["changes"] as { table: string }[];
    expect(changes.some((ch) => ch.table === "focus_sessions")).toBe(true);

    expect((await call(app, "DELETE", `/focus/${id}`)).status).toBe(200);
    expect((await call(app, "PATCH", `/focus/${id}`, { completed: false })).status).toBe(404);
    expect((await call(app, "POST", "/focus", { plannedMin: 0 })).status).toBe(400);
  });
});
