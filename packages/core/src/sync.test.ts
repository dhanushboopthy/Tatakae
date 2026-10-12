import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RANKED,
  MAX_RANKED,
  RANKED_SLOTS,
  dayRow,
  firstFreeRanked,
  missionRow,
  slotRank,
  outboxItem,
  p1Ready,
  rowSchemas,
  storyPack,
  syncResponse,
  validateForge,
  type ForgeMission,
  type OutboxItem,
  type SyncRequest,
  type SyncResponse,
} from "./schemas";
import { DEFAULT_SCORING } from "./scoring";
import { DEFAULT_SETTINGS, defaultRechargeRows, defaultSettingRows, readSettings } from "./settings";
import {
  FREE_MISSION_FIELDS,
  LOCKED_MISSION_FIELDS,
  SYNC_TABLES,
  compareIso,
  isLockedChange,
  isServerAuthoritative,
  isSyncTable,
  mergeLww,
  primaryKeyOf,
  shouldApplyIncoming,
  splitPrimaryKey,
  type SyncTable,
} from "./sync";
import { SyncHttpError, createSyncClient, newId, reschedule, type LocalStore, type SyncStatus } from "./syncClient";
import type { Day, Mission, Slot } from "./types";

const T0 = "2026-10-20T08:00:00.000Z";
const T1 = "2026-10-20T09:00:00.000Z";
const T2 = "2026-10-20T10:00:00.000Z";

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "01JM0000000000000000000001",
    title: "Write Terraform module",
    dayDate: "2026-10-20",
    slot: "P1",
    points: null,
    status: "open",
    minimum: "Write the variables file",
    ifThen: "If it's 07:00, then I open the editor",
    resumeNote: null,
    goalId: null,
    estMin: 50,
    actualMin: null,
    rescheduleCount: 0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

function day(overrides: Partial<Day> = {}): Day {
  return {
    date: "2026-10-20",
    kind: "normal",
    screenMin: null,
    smallWin: null,
    qP1: null,
    qDrift: null,
    qPractised: null,
    intention: null,
    energy: null,
    forgedAt: null,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

// ===================== pure helpers =====================
describe("SYNC_TABLES", () => {
  it("lists v1 and v2 synced tables and never notes/sessions", () => {
    expect(SYNC_TABLES).toContain("days");
    expect(SYNC_TABLES).toContain("watch_queue");
    expect(SYNC_TABLES).toContain("focus_sessions");
    expect(SYNC_TABLES).toHaveLength(17);
    expect(isSyncTable("notes")).toBe(false);
    expect(isSyncTable("sessions")).toBe(false);
    expect(isSyncTable("missions")).toBe(true);
  });

  it("has a row schema for every synced table", () => {
    for (const t of SYNC_TABLES) expect(rowSchemas[t]).toBeDefined();
  });
});

describe("primaryKeyOf / splitPrimaryKey", () => {
  it.each<[SyncTable, Record<string, unknown>, string]>([
    ["missions", { id: "M1" }, "M1"],
    ["days", { date: "2026-10-20" }, "2026-10-20"],
    ["settings", { key: "wake_time" }, "wake_time"],
    ["habit_logs", { habitId: "H1", date: "2026-10-20" }, "H1|2026-10-20"],
    ["watch_queue", { title: "Some Show" }, "Some Show"],
  ])("%s → %s", (table, row, pk) => {
    expect(primaryKeyOf(table, row)).toBe(pk);
    expect(splitPrimaryKey(table, pk)).toEqual(row);
  });

  it("throws when a key field is missing", () => {
    expect(() => primaryKeyOf("habit_logs", { habitId: "H1" })).toThrow();
  });
});

describe("compareIso / mergeLww / shouldApplyIncoming", () => {
  it("compares instants, not strings", () => {
    expect(compareIso("2026-10-20T08:00:00Z", "2026-10-20T08:00:00.000Z")).toBe(0);
    expect(compareIso(T0, T1)).toBeLessThan(0);
  });

  it.each([
    ["remote newer → remote", T0, T1, "remote"],
    ["local newer → local", T1, T0, "local"],
    ["tie → remote (server) wins", T1, T1, "remote"],
  ])("%s", (_name, localAt, remoteAt, winner) => {
    const local = { updatedAt: localAt, who: "local" };
    const remote = { updatedAt: remoteAt, who: "remote" };
    expect(mergeLww(local, remote).who).toBe(winner);
  });

  it.each([
    ["no server row", null, T0, true],
    ["incoming newer", { updatedAt: T0 }, T1, true],
    ["tie → server wins", { updatedAt: T1 }, T1, false],
    ["incoming older", { updatedAt: T1 }, T0, false],
  ])("server applies incoming: %s", (_name, server, incomingAt, expected) => {
    expect(shouldApplyIncoming(server, { updatedAt: incomingAt })).toBe(expected);
  });
});

describe("isServerAuthoritative", () => {
  it.each<[string, string, Record<string, unknown>, ReadonlySet<string> | string[] | undefined, boolean]>([
    ["days rows always", "days", { date: "2026-10-20" }, undefined, true],
    ["mission on forged day (set)", "missions", { dayDate: "2026-10-20" }, new Set(["2026-10-20"]), true],
    ["mission on forged day (array)", "missions", { dayDate: "2026-10-20" }, ["2026-10-20"], true],
    ["mission on unforged day", "missions", { dayDate: "2026-10-21" }, new Set(["2026-10-20"]), false],
    ["backlog mission", "missions", { dayDate: null }, new Set(["2026-10-20"]), false],
    ["mission with unknown forged dates → conservative", "missions", { dayDate: "2026-10-21" }, undefined, true],
    ["other tables never", "inbox", { id: "x" }, undefined, false],
  ])("%s", (_name, table, row, forged, expected) => {
    expect(isServerAuthoritative(table, row, forged)).toBe(expected);
  });
});

describe("isLockedChange", () => {
  it("lists locked and free fields without overlap", () => {
    const locked: readonly string[] = LOCKED_MISSION_FIELDS;
    expect(FREE_MISSION_FIELDS.some((f) => locked.includes(f))).toBe(false);
  });

  it.each<[string, Mission | null, Mission, boolean, boolean]>([
    ["not forged → never locked", mission(), mission({ title: "Other" }), false, false],
    ["free field change on forged day", mission(), mission({ status: "done", resumeNote: "next: tests", actualMin: 40 }), true, false],
    ["title change on forged day", mission(), mission({ title: "Other" }), true, true],
    ["slot change", mission(), mission({ slot: "P2" }), true, true],
    ["points change", mission(), mission({ points: 2 }), true, true],
    ["minimum change", mission(), mission({ minimum: "less" }), true, true],
    ["ifThen change", mission(), mission({ ifThen: "If x then y" }), true, true],
    ["moving off the day", mission(), mission({ dayDate: "2026-10-21" }), true, true],
    ["create on forged day", null, mission(), true, true],
    ["delete on forged day", mission(), mission({ deletedAt: T1 }), true, true],
    ["goalId is not locked", mission(), mission({ goalId: "G1" }), true, false],
  ])("%s", (_name, prev, next, forged, expected) => {
    expect(isLockedChange(prev, next, forged)).toBe(expected);
  });
});

// ===================== schemas =====================
describe("row schemas", () => {
  it("accept full rows", () => {
    expect(missionRow.safeParse(mission()).success).toBe(true);
    expect(dayRow.safeParse(day()).success).toBe(true);
  });

  it("reject bad enums and missing meta", () => {
    expect(missionRow.safeParse(mission({ status: "nope" as Mission["status"] })).success).toBe(false);
    const { updatedAt: _u, ...noMeta } = day();
    expect(dayRow.safeParse(noMeta).success).toBe(false);
  });
});

describe("p1Ready / validateForge", () => {
  it.each<[string, Parameters<typeof p1Ready>[0], boolean]>([
    ["P1 complete", { slot: "P1", minimum: "a", ifThen: "b" }, true],
    ["P1 missing minimum", { slot: "P1", minimum: null, ifThen: "b" }, false],
    ["P1 blank if-then", { slot: "P1", minimum: "a", ifThen: "  " }, false],
    ["P2 needs nothing", { slot: "P2", minimum: null, ifThen: null }, true],
  ])("p1Ready: %s", (_name, m, expected) => {
    expect(p1Ready(m)).toBe(expected);
  });

  const fm = (o: Partial<ForgeMission>): ForgeMission => ({ slot: "P1", status: "open", minimum: "a", ifThen: "b", ...o });
  it.each<[string, ForgeMission[], string[]]>([
    ["valid plan", [fm({}), fm({ slot: "P2" }), fm({ slot: "P3" }), fm({ slot: "side" })], []],
    ["no P1", [fm({ slot: "P2" })], ["no_p1"]],
    ["P1 incomplete", [fm({ minimum: null, ifThen: "" })], ["p1_missing_minimum", "p1_missing_if_then"]],
    ["two P2", [fm({}), fm({ slot: "P2" }), fm({ slot: "P2" })], ["duplicate_slot"]],
    [
      "nine ranked missions",
      (["P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"] as const).reduce((ms, slot) => [...ms, fm({ slot })], [fm({})]),
      [],
    ],
    ["two P7", [fm({}), fm({ slot: "P7" }), fm({ slot: "P7" })], ["duplicate_slot"]],
    ["two side quests", [fm({}), fm({ slot: "side" }), fm({ slot: "side" })], ["too_many_side"]],
    ["deleted P1 does not count", [fm({ deletedAt: T0 })], ["no_p1"]],
  ])("validateForge: %s", (_name, missions, expected) => {
    expect(validateForge(missions)).toEqual(expected);
  });

  it("ranked slots: 5 by default, up to 9, ordered before side and backlog", () => {
    expect(DEFAULT_RANKED).toBe(5);
    expect(MAX_RANKED).toBe(9);
    expect(missionRow.shape.slot.safeParse("P9").success).toBe(true);
    expect(missionRow.shape.slot.safeParse("P10").success).toBe(false);
    expect(["backlog", "side", "P9", "P2", "P1"].sort((a, b) => slotRank(a as Slot) - slotRank(b as Slot))).toEqual(["P1", "P2", "P9", "side", "backlog"]);
  });

  it("firstFreeRanked skips used, deleted-free and rescheduled slots", () => {
    expect(firstFreeRanked([{ slot: "P1" }, { slot: "P2" }])).toBe("P3");
    expect(firstFreeRanked([{ slot: "P1" }, { slot: "P2", status: "rescheduled" }])).toBe("P2");
    expect(firstFreeRanked([{ slot: "P2", deletedAt: T0 }])).toBe("P2");
    expect(firstFreeRanked([], { includeP1: true })).toBe("P1");
    expect(firstFreeRanked(RANKED_SLOTS.map((slot) => ({ slot })))).toBeNull();
  });
});

describe("outbox / sync wire schemas", () => {
  it("outbox item accepts optional lockReason meta and rejects unknown tables", () => {
    const base = { id: "I1", table: "missions", op: "upsert", row: {}, updatedAt: T0 };
    expect(outboxItem.safeParse({ ...base, meta: { lockReason: "doctor appointment" } }).success).toBe(true);
    expect(outboxItem.safeParse(base).success).toBe(true);
    expect(outboxItem.safeParse({ ...base, table: "notes" }).success).toBe(false);
  });

  it("sync response allows a null server row in conflicts", () => {
    expect(syncResponse.safeParse({ applied: [], conflicts: [{ id: "I1", server: null }], changes: [], cursor: "1" }).success).toBe(true);
  });
});

describe("story pack schema", () => {
  const ref = { title: "Example", medium: "series", character: null, lesson: "Small reps beat big efforts.", moment: "minimum_done", yourLine: null };
  it("accepts version 1 packs", () => {
    expect(storyPack.safeParse({ version: 1, refs: [ref] }).success).toBe(true);
  });
  it.each([
    ["lesson over 160 chars", { version: 1, refs: [{ ...ref, lesson: "x".repeat(161) }] }],
    ["unknown moment", { version: 1, refs: [{ ...ref, moment: "morning" }] }],
    ["wrong version", { version: 2, refs: [ref] }],
  ])("rejects %s", (_name, pack) => {
    expect(storyPack.safeParse(pack).success).toBe(false);
  });
});

describe("settings defaults", () => {
  it("default rows match DEFAULT_SETTINGS and only scoring is even_sunday", () => {
    const rows = defaultSettingRows();
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(rows.find((r) => r.key === "scoring")?.editableFrom).toBe("even_sunday");
    expect(rows.filter((r) => r.editableFrom !== null)).toHaveLength(1);
    expect(JSON.parse(rows.find((r) => r.key === "scoring")?.value ?? "null")).toEqual(DEFAULT_SCORING);
  });

  it("five recharge items with fixed 26-char ids", () => {
    const rows = defaultRechargeRows();
    expect(rows.map((r) => r.kind)).toEqual(["walk", "music", "call", "stretch", "sketch"]);
    for (const r of rows) expect(r.id).toHaveLength(26);
  });

  it("readSettings falls back per key and merges scoring", () => {
    const s = readSettings([
      { key: "wake_time", value: '"07:15"', deletedAt: null },
      { key: "ritual_time", value: '"25:00"', deletedAt: null }, // invalid → default
      { key: "focus_default", value: "90", deletedAt: T0 }, // deleted → default
      { key: "scoring", value: '{"strongAt":85}', deletedAt: null },
      { key: "unknown", value: "1", deletedAt: null },
    ]);
    expect(s.wake_time).toBe("07:15");
    expect(s.ritual_time).toBe("21:30");
    expect(s.focus_default).toBe(50);
    expect(s.scoring).toEqual({ ...DEFAULT_SCORING, strongAt: 85 });
  });
});

// ===================== ids + reschedule =====================
describe("newId", () => {
  it("is a 26-char Crockford ULID, time-sortable", () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_001);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a < b).toBe(true);
    expect(newId()).not.toBe(newId());
  });
});

describe("reschedule", () => {
  it("marks the original rescheduled and creates a backlog copy carrying the count", () => {
    const [orig, copy] = reschedule(mission({ rescheduleCount: 1, actualMin: 10 }));
    expect(orig).toMatchObject({ id: mission().id, status: "rescheduled", rescheduleCount: 2, dayDate: "2026-10-20" });
    expect(copy).toMatchObject({ dayDate: null, slot: "backlog", status: "backlog", rescheduleCount: 2, title: mission().title, actualMin: null });
    expect(copy.id).not.toBe(orig.id);
  });
});

// ===================== sync client =====================
interface MemoryStore extends LocalStore {
  rows: Map<string, Record<string, unknown>>;
  outbox: OutboxItem[];
  meta: Map<string, string>;
}

function memoryStore(): MemoryStore {
  const rows = new Map<string, Record<string, unknown>>();
  const outbox: OutboxItem[] = [];
  const meta = new Map<string, string>();
  const k = (table: string, pk: string) => `${table}:${pk}`;
  return {
    rows,
    outbox,
    meta,
    get: async (table, pk) => (rows.get(k(table, pk)) ?? null) as never,
    getAll: async (table, opts) =>
      [...rows.entries()]
        .filter(([key, r]) => key.startsWith(`${table}:`) && (opts?.includeDeleted || r["deletedAt"] == null))
        .map(([, r]) => r) as never,
    put: async (table, row) => {
      rows.set(k(table, primaryKeyOf(table, row)), { ...row });
    },
    enqueue: async (item) => {
      outbox.push(item);
    },
    peekOutbox: async (limit) => outbox.slice(0, limit),
    removeOutbox: async (ids) => {
      for (let i = outbox.length - 1; i >= 0; i--) if (ids.includes(outbox[i]?.id ?? "")) outbox.splice(i, 1);
    },
    countOutbox: async () => outbox.length,
    getMeta: async (key) => meta.get(key) ?? null,
    setMeta: async (key, value) => {
      meta.set(key, value);
    },
  };
}

const drain = async () => {
  for (let i = 0; i < 500; i++) await Promise.resolve();
};

function setup(post: (req: SyncRequest) => Promise<SyncResponse>) {
  const store = memoryStore();
  const onChange = vi.fn<(tables: ReadonlySet<SyncTable>) => void>();
  const onAuthError = vi.fn<() => void>();
  const onConflict = vi.fn();
  const postFn = vi.fn(post);
  let clock = new Date(T1);
  const client = createSyncClient({
    store,
    client: "mobile",
    post: postFn,
    onChange,
    onAuthError,
    onConflict,
    now: () => clock,
  });
  const statuses: SyncStatus[] = [];
  client.subscribe((s) => statuses.push(s));
  return { store, client, post: postFn, onChange, onAuthError, onConflict, statuses, setClock: (iso: string) => (clock = new Date(iso)) };
}

const ok = (req: SyncRequest, extra: Partial<SyncResponse> = {}): SyncResponse => ({
  applied: req.items.map((i) => i.id),
  conflicts: [],
  changes: [],
  cursor: "10",
  ...extra,
});

describe("createSyncClient", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("write stores optimistically, enqueues, notifies and counts pending", async () => {
    const t = setup(async (req) => ok(req));
    const { updatedAt: _u, deletedAt: _d, ...input } = mission();
    const stored = await t.client.write("missions", input);
    expect(stored.updatedAt).toBe(T1);
    expect(stored.deletedAt).toBeNull();
    expect(t.store.rows.get(`missions:${mission().id}`)).toMatchObject({ title: mission().title, updatedAt: T1 });
    expect(t.store.outbox).toHaveLength(1);
    expect(t.store.outbox[0]).toMatchObject({ table: "missions", op: "upsert", updatedAt: T1 });
    expect(t.store.outbox[0]?.meta).toBeUndefined();
    expect(t.onChange).toHaveBeenCalledWith(new Set(["missions"]));
    expect(t.client.getStatus().pending).toBe(1);
  });

  it("subscribe calls the listener immediately", () => {
    const t = setup(async (req) => ok(req));
    expect(t.statuses[0]).toEqual({ state: "idle", lastSyncAt: null, pending: 0, error: null });
  });

  it("flush pushes the outbox, applies changes, stores the cursor and goes idle", async () => {
    const t = setup(async (req) => ok(req, { changes: [{ table: "days", row: { ...day(), smallWin: "shipped" } }] }));
    await t.client.write("missions", mission());
    await t.client.flush();
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.post.mock.calls[0]?.[0]).toMatchObject({ client: "mobile", cursor: null });
    expect(t.post.mock.calls[0]?.[0].items).toHaveLength(1);
    expect(t.store.outbox).toHaveLength(0);
    expect(t.store.meta.get("cursor")).toBe("10");
    expect(t.store.rows.get("days:2026-10-20")).toMatchObject({ smallWin: "shipped" });
    expect(t.client.getStatus()).toMatchObject({ state: "idle", pending: 0, lastSyncAt: T1, error: null });
  });

  it("pulls even when the outbox is empty, sending the stored cursor", async () => {
    const t = setup(async (req) => ok(req));
    t.store.meta.set("cursor", "7");
    await t.client.flush();
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.post.mock.calls[0]?.[0]).toMatchObject({ cursor: "7", items: [] });
  });

  it("applies remote changes with LWW (local newer kept, tie → remote)", async () => {
    const t = setup(async (req) =>
      ok(req, {
        changes: [
          { table: "missions", row: { ...mission({ id: "A", title: "remote A" }), updatedAt: T0 } },
          { table: "missions", row: { ...mission({ id: "B", title: "remote B" }), updatedAt: T1 } },
        ],
      }),
    );
    await t.store.put("missions", mission({ id: "A", title: "local A", updatedAt: T1 }));
    await t.store.put("missions", mission({ id: "B", title: "local B", updatedAt: T1 }));
    await t.client.flush();
    expect(t.store.rows.get("missions:A")?.["title"]).toBe("local A");
    expect(t.store.rows.get("missions:B")?.["title"]).toBe("remote B");
  });

  it("conflicts: server row replaces local and the item leaves the outbox", async () => {
    const server = mission({ title: "server title", updatedAt: T2 });
    const t = setup(async (req) => ({ applied: [], conflicts: [{ id: req.items[0]?.id ?? "", server: { ...server } }], changes: [], cursor: "11" }));
    await t.client.write("missions", mission({ title: "local title" }));
    await t.client.flush();
    expect(t.store.outbox).toHaveLength(0);
    expect(t.store.rows.get(`missions:${server.id}`)?.["title"]).toBe("server title");
    expect(t.onConflict).toHaveBeenCalledTimes(1);
  });

  it("conflict with no server row hides the rejected local create", async () => {
    const t = setup(async (req) => ({ applied: [], conflicts: [{ id: req.items[0]?.id ?? "", server: null }], changes: [], cursor: "11" }));
    await t.client.write("missions", mission());
    await t.client.flush();
    expect(t.store.rows.get(`missions:${mission().id}`)?.["deletedAt"]).not.toBeNull();
  });

  it("remove soft-deletes with op delete and carries the lock reason", async () => {
    const t = setup(async (req) => ok(req));
    await t.store.put("missions", mission());
    await t.client.remove("missions", mission().id, { lockReason: "plan changed at work" });
    expect(t.store.rows.get(`missions:${mission().id}`)).toMatchObject({ deletedAt: T1, updatedAt: T1 });
    expect(t.store.outbox[0]).toMatchObject({ op: "delete", meta: { lockReason: "plan changed at work" } });
  });

  it("remove is a no-op for missing rows", async () => {
    const t = setup(async (req) => ok(req));
    await t.client.remove("missions", "missing");
    expect(t.store.outbox).toHaveLength(0);
  });

  it("401 calls onAuthError and keeps the outbox", async () => {
    const t = setup(async () => {
      throw new SyncHttpError(401);
    });
    await t.client.write("inbox", { id: "I1", text: "buy milk", createdAt: T0, processed: false });
    await t.client.flush();
    expect(t.onAuthError).toHaveBeenCalledTimes(1);
    expect(t.store.outbox).toHaveLength(1);
    expect(t.client.getStatus()).toMatchObject({ state: "error", error: "auth" });
  });

  it("network errors go offline, keep items and retry with backoff", async () => {
    let fail = true;
    const t = setup(async (req) => {
      if (fail) throw new TypeError("Failed to fetch");
      return ok(req);
    });
    await t.client.write("inbox", { id: "I1", text: "buy milk", createdAt: T0, processed: false });
    await t.client.flush();
    expect(t.client.getStatus().state).toBe("offline");
    expect(t.store.outbox).toHaveLength(1);
    fail = false;
    await vi.advanceTimersByTimeAsync(2_000);
    await drain();
    expect(t.store.outbox).toHaveLength(0);
    expect(t.client.getStatus().state).toBe("idle");
  });

  it("server errors (5xx) show state error and keep items", async () => {
    const t = setup(async () => {
      throw new SyncHttpError(503);
    });
    await t.client.write("inbox", { id: "I1", text: "x", createdAt: T0, processed: false });
    await t.client.flush();
    expect(t.client.getStatus().state).toBe("error");
    expect(t.store.outbox).toHaveLength(1);
  });

  it("auto-flushes 2 s after the last write (debounced)", async () => {
    const t = setup(async (req) => ok(req));
    await t.client.write("inbox", { id: "I1", text: "a", createdAt: T0, processed: false });
    await vi.advanceTimersByTimeAsync(1_000);
    await t.client.write("inbox", { id: "I2", text: "b", createdAt: T0, processed: false });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(t.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    await drain();
    expect(t.post).toHaveBeenCalledTimes(1);
    expect(t.post.mock.calls[0]?.[0].items).toHaveLength(2);
  });

  it("stop() cancels the scheduled flush", async () => {
    const t = setup(async (req) => ok(req));
    await t.client.write("inbox", { id: "I1", text: "a", createdAt: T0, processed: false });
    t.client.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    await drain();
    expect(t.post).not.toHaveBeenCalled();
  });

  it("flush is single-flight", async () => {
    const t = setup(async (req) => ok(req));
    const a = t.client.flush();
    const b = t.client.flush();
    expect(a).toBe(b);
    await a;
  });

  it("sends at most 500 items per request and loops until the outbox is empty", async () => {
    const t = setup(async (req) => ok(req));
    for (let i = 0; i < 501; i++) {
      t.store.outbox.push({ id: `I${i}`, table: "inbox", op: "upsert", row: {}, updatedAt: T0 });
    }
    await t.client.flush();
    expect(t.post).toHaveBeenCalledTimes(2);
    expect(t.post.mock.calls[0]?.[0].items).toHaveLength(500);
    expect(t.post.mock.calls[1]?.[0].items).toHaveLength(1);
    expect(t.store.outbox).toHaveLength(0);
  });
});
