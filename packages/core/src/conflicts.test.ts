import { afterEach, describe, expect, it, vi } from "vitest";
import { conflictLabel, conflictMessage, createConflictLog, describeConflict } from "./conflicts";
import type { OutboxItem } from "./schemas";
import type { SyncConflictEvent } from "./syncClient";

const item = (updatedAt: string, table: OutboxItem["table"] = "missions", id = "m1"): OutboxItem => ({
  id: "item-1",
  table,
  op: "upsert",
  row: table === "days" ? { date: "2026-10-20", updatedAt } : { id, updatedAt },
  updatedAt,
});
const ev = (i: OutboxItem, server: SyncConflictEvent["server"]): SyncConflictEvent => ({ item: i, server });

describe("describeConflict", () => {
  it("newer when another device saved later", () => {
    const n = describeConflict(ev(item("2026-10-20T08:00:00Z"), { id: "m1", updatedAt: "2026-10-20T08:05:00Z" }), 1);
    expect(n).toEqual({ table: "missions", pk: "m1", kind: "newer", at: 1 });
  });
  it("kept when the server refused an equal or older write (plan lock, guards)", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z"), { id: "m1", updatedAt: "2026-10-20T07:00:00Z" }))?.kind).toBe("kept");
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z"), { id: "m1", updatedAt: "2026-10-20T08:00:00Z" }))?.kind).toBe("kept");
  });
  it("kept when the server row has no updatedAt", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z"), { id: "m1" }))?.kind).toBe("kept");
  });
  it("undone when the server has no row", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z"), null))?.kind).toBe("undone");
  });
  it("uses the table's primary key", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z", "days"), null))?.pk).toBe("2026-10-20");
  });
  it("ignores tables that don't sync", () => {
    const bad = { ...item("2026-10-20T08:00:00Z"), table: "notes" } as unknown as OutboxItem;
    expect(describeConflict(ev(bad, null))).toBeNull();
  });
});

describe("conflictMessage", () => {
  const n = (kind: "newer" | "kept" | "undone") => ({ table: "missions" as const, pk: "m", kind, at: 0 });
  it("is calm and short", () => {
    expect(conflictMessage([])).toBeNull();
    expect(conflictMessage([n("newer")])).toBe("Edited on another device. Showing the newest version.");
    expect(conflictMessage([n("newer"), n("kept")])).toBe("2 items were edited on another device. Showing the newest versions.");
    expect(conflictMessage([n("kept")])).toBe("A change didn't go through. The saved version stays.");
    expect(conflictMessage([n("undone")])).toBe("A change didn't go through, so it was undone.");
  });
  it("labels", () => {
    expect(conflictLabel("newer")).toBe("Edited elsewhere");
    expect(conflictLabel("kept")).toBe("Change not saved");
    expect(conflictLabel("undone")).toBe("Change not saved");
  });
});

describe("createConflictLog", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the latest note per row and forgets it after the window", () => {
    let t = 1_000;
    const log = createConflictLog({ windowMs: 100, now: () => t });
    log.record(ev(item("2026-10-20T08:00:00Z"), null));
    t = 1_010;
    log.record(ev(item("2026-10-20T08:00:00Z"), { id: "m1", updatedAt: "2026-10-20T09:00:00Z" }));
    expect(log.snapshot()).toHaveLength(1);
    expect(log.noteFor("missions", "m1")?.kind).toBe("newer");
    expect(log.noteFor("missions", "other")).toBeNull();
    t = 1_200;
    expect(log.noteFor("missions", "m1")).toBeNull();
  });

  it("drops expired notes when a new one arrives", () => {
    let t = 0;
    const log = createConflictLog({ windowMs: 100, now: () => t });
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "a"), null));
    t = 500;
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "b"), null));
    expect(log.snapshot().map((n) => n.pk)).toEqual(["b"]);
  });

  it("tells subscribers on every change and batches one call per round", () => {
    vi.useFakeTimers();
    const log = createConflictLog({ batchMs: 300 });
    const changed = vi.fn();
    const batches: number[] = [];
    const offChange = log.subscribe(changed);
    log.onBatch((b) => batches.push(b.length));
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "a"), null));
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "b"), null));
    expect(changed).toHaveBeenCalledTimes(2);
    expect(batches).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(batches).toEqual([2]);
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "c"), null));
    vi.advanceTimersByTime(300);
    expect(batches).toEqual([2, 1]);
    offChange();
    log.record(ev(item("2026-10-20T08:00:00Z", "missions", "d"), null));
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it("skips events it can't describe", () => {
    const log = createConflictLog();
    const changed = vi.fn();
    log.subscribe(changed);
    log.record(ev({ ...item("2026-10-20T08:00:00Z"), table: "notes" } as unknown as OutboxItem, null));
    expect(changed).not.toHaveBeenCalled();
    expect(log.snapshot()).toEqual([]);
  });
});
