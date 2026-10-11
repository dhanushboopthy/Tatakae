import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutboxItem, SyncResponse } from "@tatakae/core";
import { getRow } from "../lib/rows.service";
import { at, call, day, login, mission, setup, type TestApp } from "../test/helpers";

let seq = 0;
function item(table: OutboxItem["table"], row: object, extra: Partial<OutboxItem> = {}): OutboxItem {
  const r = row as Record<string, unknown>;
  seq += 1;
  return {
    id: `item-${seq}`,
    table,
    op: "upsert",
    row: r,
    updatedAt: typeof r["updatedAt"] === "string" ? r["updatedAt"] : at(0),
    ...extra,
  };
}

async function sync(app: TestApp, items: OutboxItem[], cursor: string | null = "0"): Promise<SyncResponse> {
  const res = await call(app, "POST", "/sync", { client: "mobile", cursor, items });
  expect(res.status).toBe(200);
  return res.body as unknown as SyncResponse;
}

const rowsOf = (res: SyncResponse, table: string) => res.changes.filter((c) => c.table === table).map((c) => c.row);

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /sync", () => {
  it("needs auth", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/sync", { client: "web", cursor: null, items: [] }, {});
    expect(res.status).toBe(401);
  });

  it("works with a mobile session token", async () => {
    const { app } = await setup();
    const auth = await login(app, "mobile");
    const res = await call(app, "POST", "/sync", { client: "mobile", cursor: null, items: [] }, auth);
    expect(res.status).toBe(200);
  });

  it("rejects a malformed request with 400", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/sync", { client: "fridge", cursor: null, items: [] });
    expect(res.status).toBe(400);
  });

  it("null cursor returns a full snapshot including seeded defaults", async () => {
    const { app } = await setup();
    const res = await sync(app, [], null);
    expect(res.applied).toEqual([]);
    expect(res.conflicts).toEqual([]);
    expect(rowsOf(res, "settings").map((r) => r["key"])).toContain("scoring");
    expect(rowsOf(res, "recharge_items")).toHaveLength(5);
    expect(res.cursor).toBe("0");
  });

  it("applies a new row and returns only later changes for a cursor", async () => {
    const { app } = await setup();
    const first = await sync(app, [item("missions", mission())]);
    expect(first.applied).toHaveLength(1);
    expect(rowsOf(first, "missions")).toEqual([mission()]);
    expect(Number(first.cursor)).toBeGreaterThan(0);

    const second = await sync(app, [], first.cursor);
    expect(second.changes).toEqual([]);
    expect(second.cursor).toBe(first.cursor);

    // A REST write shows up in the next pull.
    const created = await call(app, "POST", "/inbox", { text: "idea" });
    expect(created.status).toBe(201);
    const third = await sync(app, [], second.cursor);
    expect(rowsOf(third, "inbox")).toHaveLength(1);
  });

  it("is idempotent by outbox item id", async () => {
    const { app, db } = await setup();
    const it1 = item("missions", mission());
    expect((await sync(app, [it1])).applied).toEqual([it1.id]);
    const replay = { ...it1, row: { ...it1.row, title: "Changed", updatedAt: at(5) }, updatedAt: at(5) };
    const res = await sync(app, [replay]);
    expect(res.applied).toEqual([it1.id]);
    expect(getRow(db, "missions", mission().id)?.title).toBe(mission().title);
  });

  it("last write wins by updatedAt; ties go to the server", async () => {
    const { app } = await setup();
    await sync(app, [item("missions", mission({ updatedAt: at(10) }))]);

    const older = item("missions", mission({ title: "older", updatedAt: at(5) }));
    const tie = item("missions", mission({ title: "tie", updatedAt: at(10) }));
    const res = await sync(app, [older, tie]);
    expect(res.applied).toEqual([]);
    expect(res.conflicts.map((c) => c.id)).toEqual([older.id, tie.id]);
    expect(res.conflicts[0]?.server).toMatchObject({ title: mission().title, updatedAt: at(10) });

    const newer = item("missions", mission({ title: "newer", status: "done", updatedAt: at(11) }));
    const ok = await sync(app, [newer]);
    expect(ok.applied).toEqual([newer.id]);
  });

  it("an invalid row is a conflict", async () => {
    const { app } = await setup();
    const bad = item("missions", { ...mission(), slot: "P9" });
    const res = await sync(app, [bad]);
    expect(res.conflicts).toEqual([{ id: bad.id, server: null }]);
  });

  it("delete op soft-deletes with deletedAt = updatedAt", async () => {
    const { app, db } = await setup();
    await sync(app, [item("missions", mission())]);
    const del = item("missions", { ...mission(), updatedAt: at(3), deletedAt: at(3) }, { op: "delete" });
    const res = await sync(app, [del]);
    expect(res.applied).toEqual([del.id]);
    expect(getRow(db, "missions", mission().id)).toMatchObject({ deletedAt: at(3), updatedAt: at(3) });
  });

  describe("plan lock", () => {
    it("a forge request with an unready P1 is a conflict; the rest of the day row is kept", async () => {
      const { app } = await setup();
      const m = item("missions", mission({ minimum: null }));
      const d = item("days", day({ forgedAt: at(1), qP1: "yes", updatedAt: at(1) }));
      const res = await sync(app, [m, d]);
      expect(res.applied).toEqual([m.id]);
      expect(res.conflicts).toHaveLength(1);
      expect(res.conflicts[0]?.server).toMatchObject({ date: "2026-10-20", forgedAt: null, qP1: "yes" });
    });

    it("a valid forge request is stamped with server time", async () => {
      const { app } = await setup();
      const clientForgedAt = "2000-01-01T00:00:00.000Z";
      const res = await sync(app, [item("missions", mission()), item("days", day({ forgedAt: clientForgedAt, updatedAt: at(1) }))]);
      expect(res.conflicts).toEqual([]);
      const [d] = rowsOf(res, "days");
      expect(d?.["forgedAt"]).not.toBeNull();
      expect(d?.["forgedAt"]).not.toBe(clientForgedAt);
    });

    async function forged() {
      const ctx = await setup();
      const res = await sync(ctx.app, [item("missions", mission()), item("days", day({ forgedAt: at(1), updatedAt: at(1) }))]);
      expect(res.conflicts).toEqual([]);
      return ctx;
    }

    it("a forged day cannot be un-forged through sync", async () => {
      const { app, db } = await forged();
      const res = await sync(app, [item("days", day({ forgedAt: null, smallWin: "ok", updatedAt: at(20) }))]);
      expect(res.conflicts).toEqual([]);
      expect(getRow(db, "days", "2026-10-20")).toMatchObject({ smallWin: "ok" });
      expect(getRow(db, "days", "2026-10-20")?.forgedAt).not.toBeNull();
    });

    it("a locked field change without meta.lockReason is a conflict", async () => {
      const { app } = await forged();
      const change = item("missions", mission({ title: "Different", updatedAt: at(30) }));
      const res = await sync(app, [change]);
      expect(res.conflicts).toEqual([{ id: change.id, server: expect.objectContaining({ title: mission().title }) }]);
    });

    it("a locked change with meta.lockReason applies and records a mura event", async () => {
      const { app } = await forged();
      const change = item("missions", mission({ title: "Different", updatedAt: at(30) }), { meta: { lockReason: "meeting moved" } });
      const res = await sync(app, [change]);
      expect(res.applied).toEqual([change.id]);
      const mura = rowsOf(res, "mura_events");
      expect(mura).toHaveLength(1);
      expect(mura[0]).toMatchObject({ missionId: mission().id, reason: "meeting moved" });
    });

    it("free fields sync without a reason", async () => {
      const { app } = await forged();
      const change = item("missions", mission({ status: "done", actualMin: 40, updatedAt: at(30) }));
      expect((await sync(app, [change])).applied).toEqual([change.id]);
    });

    it("a new mission on a forged day without a reason is a rejected create (server null)", async () => {
      const { app } = await forged();
      const extra = item("missions", mission({ id: "01JTESTMISSION000000000002", slot: "P2", updatedAt: at(30) }));
      const res = await sync(app, [extra]);
      expect(res.conflicts).toEqual([{ id: extra.id, server: null }]);
    });
  });

  describe("guards", () => {
    it("scoring settings sync only on even-week Sundays", async () => {
      const { app } = await setup();
      const scoringRow = (updatedAt: string) => ({
        key: "scoring",
        value: JSON.stringify({ strongAt: 90 }),
        editableFrom: null,
        updatedAt,
        deletedAt: null,
      });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-21T10:00:00+05:30")); // Wednesday
      const locked = item("settings", scoringRow(at(1)));
      const res = await sync(app, [locked]);
      expect(res.conflicts.map((c) => c.id)).toEqual([locked.id]);

      vi.setSystemTime(new Date("2026-10-18T10:00:00+05:30")); // even-week Sunday
      const ok = item("settings", scoringRow(at(2)));
      const res2 = await sync(app, [ok]);
      expect(res2.applied).toEqual([ok.id]);
      // editableFrom stays server-owned.
      expect(rowsOf(res2, "settings").find((r) => r["key"] === "scoring")).toMatchObject({ editableFrom: "even_sunday" });
    });

    it("an invalid value for a known setting is a conflict", async () => {
      const { app } = await setup();
      const bad = item("settings", { key: "wake_time", value: JSON.stringify("25:99"), editableFrom: null, updatedAt: at(1), deletedAt: null });
      expect((await sync(app, [bad])).conflicts.map((c) => c.id)).toEqual([bad.id]);
    });

    it("a third write-off in a month is a conflict and the day keeps its kind", async () => {
      const { app } = await setup();
      const wo = (date: string) => item("days", day({ date, kind: "write_off", updatedAt: at(1) }));
      const a = wo("2026-10-05");
      const b = wo("2026-10-06");
      const c = wo("2026-10-07");
      const res = await sync(app, [a, b, c]);
      expect(res.applied).toEqual([a.id, b.id]);
      expect(res.conflicts).toHaveLength(1);
      expect(res.conflicts[0]?.server).toMatchObject({ date: "2026-10-07", kind: "normal" });
    });
  });

  it("an unknown or future cursor falls back to a full snapshot", async () => {
    const { app } = await setup();
    const res = await sync(app, [], "999999");
    expect(rowsOf(res, "settings").length).toBeGreaterThan(0);
    const res2 = await sync(app, [], "not-a-cursor");
    expect(rowsOf(res2, "settings").length).toBeGreaterThan(0);
  });
});
