import { afterEach, describe, expect, it } from "vitest";
import {
  createSyncClient,
  describeConflict,
  primaryKeyOf,
  SyncHttpError,
  type ConflictNote,
  type LocalStore,
  type OutboxItem,
  type SyncClient,
  type SyncResponse,
} from "@tatakae/core";
import { at, call, day, login, mission, setup, type TestApp } from "../test/helpers";

// Offline edge cases (v4.6), end to end: two real sync clients (the same core client both apps use,
// on in-memory stores) talking to the real API. Each "device" can go offline and has its own clock.

function memoryStore(): LocalStore & { outbox: OutboxItem[] } {
  const rows = new Map<string, Record<string, unknown>>();
  const outbox: OutboxItem[] = [];
  const meta = new Map<string, string>();
  const k = (table: string, pk: string) => `${table}:${pk}`;
  return {
    outbox,
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

interface Device {
  client: SyncClient;
  store: ReturnType<typeof memoryStore>;
  conflicts: ConflictNote[];
  online: boolean;
  clock: string;
}

const devices: Device[] = [];

afterEach(() => {
  for (const d of devices.splice(0)) d.client.stop();
});

async function device(app: TestApp, kind: "web" | "mobile", name: string): Promise<Device> {
  const headers = await login(app, kind, name);
  const store = memoryStore();
  const d: Device = { client: null as unknown as SyncClient, store, conflicts: [], online: true, clock: at(0) };
  d.client = createSyncClient({
    store,
    client: kind,
    post: async (req) => {
      if (!d.online) throw new TypeError("Network request failed");
      const res = await call(app, "POST", "/sync", req, headers);
      if (res.status !== 200) throw new SyncHttpError(res.status);
      return res.body as unknown as SyncResponse;
    },
    onChange: () => {},
    onAuthError: () => {},
    onConflict: (ev) => {
      const n = describeConflict(ev);
      if (n) d.conflicts.push(n);
    },
    now: () => new Date(d.clock),
    flushDelayMs: 1e9, // tests flush by hand
  });
  devices.push(d);
  return d;
}

/** Laptop + phone, both holding today's P1 (created on the laptop). */
async function pair() {
  const { app, db } = await setup();
  const laptop = await device(app, "web", "laptop-1");
  const phone = await device(app, "mobile", "phone");
  await laptop.client.write("missions", mission());
  await laptop.client.flush();
  await phone.client.flush();
  expect(await phone.store.get("missions", mission().id)).toMatchObject({ title: mission().title });
  return { app, db, laptop, phone };
}

const M = mission().id;

describe("offline edge cases", () => {
  it("offline writes wait in the outbox, then sync once with no duplicates", async () => {
    const { laptop, phone } = await pair();
    phone.online = false;
    phone.clock = at(10);
    const m = await phone.store.get("missions", M);
    await phone.client.write("missions", { ...m!, status: "done", actualMin: 45 });
    await phone.client.write("inbox", { id: "01JTESTINBOX0000000000001", text: "buy batteries", createdAt: at(10), processed: false });
    await phone.client.flush();
    expect(phone.client.getStatus().state).toBe("offline");
    expect(phone.store.outbox).toHaveLength(2);

    phone.online = true;
    await phone.client.flush();
    await phone.client.flush(); // a second flush sends nothing new
    expect(phone.store.outbox).toHaveLength(0);
    expect(phone.client.getStatus().state).toBe("idle");

    await laptop.client.flush();
    expect(await laptop.store.get("missions", M)).toMatchObject({ status: "done", actualMin: 45 });
    const inbox = await laptop.store.getAll("inbox");
    expect(inbox.map((i) => i.text)).toEqual(["buy batteries"]);
    expect(laptop.conflicts).toEqual([]);
    expect(phone.conflicts).toEqual([]);
  });

  it("both edit the same mission offline: the later edit wins on both, whichever reconnects first", async () => {
    for (const laptopFirst of [true, false]) {
      const { laptop, phone } = await pair();
      laptop.online = false;
      phone.online = false;
      laptop.clock = at(10);
      phone.clock = at(20); // the phone's edit is later
      await laptop.client.write("missions", { ...(await laptop.store.get("missions", M))!, resumeNote: "from the laptop" });
      await phone.client.write("missions", { ...(await phone.store.get("missions", M))!, resumeNote: "from the phone" });

      laptop.online = true;
      phone.online = true;
      const order = laptopFirst ? [laptop, phone, laptop] : [phone, laptop, phone];
      for (const d of order) await d.client.flush();

      for (const d of [laptop, phone]) {
        expect(await d.store.get("missions", M)).toMatchObject({ resumeNote: "from the phone" });
        expect(d.store.outbox).toHaveLength(0);
      }
      // Only an older write that reaches the server second is a conflict, and it reads "newer".
      expect(laptop.conflicts.map((n) => n.kind)).toEqual(laptopFirst ? [] : ["newer"]);
      expect(phone.conflicts).toEqual([]);
    }
  });

  it("a locked edit made offline while the laptop forged the plan is refused and reverted", async () => {
    const { laptop, phone } = await pair();
    phone.online = false;
    phone.clock = at(30);
    await phone.client.write("missions", { ...(await phone.store.get("missions", M))!, title: "Something easier" });

    laptop.clock = at(20);
    await laptop.client.write("days", day({ forgedAt: at(20), qP1: "yes" }));
    await laptop.client.flush();

    phone.online = true;
    await phone.client.flush();
    expect(phone.conflicts.map((n) => n.kind)).toEqual(["kept"]);
    expect(await phone.store.get("missions", M)).toMatchObject({ title: mission().title });
    expect((await phone.store.get("days", "2026-10-20"))?.forgedAt).not.toBeNull();
    expect(phone.store.outbox).toHaveLength(0);
  });

  it("the same offline edit with a reason goes through and the laptop sees the mura event", async () => {
    const { laptop, phone } = await pair();
    laptop.clock = at(20);
    await laptop.client.write("days", day({ forgedAt: at(20), qP1: "yes" }));
    await laptop.client.flush();
    await phone.client.flush();

    phone.online = false;
    phone.clock = at(30);
    await phone.client.write("missions", { ...(await phone.store.get("missions", M))!, title: "Something easier" }, { lockReason: "client call moved" });
    phone.online = true;
    await phone.client.flush();
    expect(phone.conflicts).toEqual([]);

    await laptop.client.flush();
    expect(await laptop.store.get("missions", M)).toMatchObject({ title: "Something easier" });
    const mura = await laptop.store.getAll("mura_events");
    expect(mura).toEqual([expect.objectContaining({ missionId: M, reason: "client call moved" })]);
  });

  it("a mission added offline to a day forged elsewhere is undone on the phone", async () => {
    const { laptop, phone } = await pair();
    phone.online = false;
    phone.clock = at(30);
    const extra = mission({ id: "01JTESTMISSION000000000002", slot: "P2", title: "Extra" });
    await phone.client.write("missions", extra);

    laptop.clock = at(20);
    await laptop.client.write("days", day({ forgedAt: at(20), qP1: "yes" }));
    await laptop.client.flush();

    phone.online = true;
    await phone.client.flush();
    expect(phone.conflicts.map((n) => n.kind)).toEqual(["undone"]);
    expect(await phone.store.getAll("missions")).toEqual([expect.objectContaining({ id: M })]);

    await laptop.client.flush();
    expect((await laptop.store.getAll("missions")).map((m) => m.id)).toEqual([M]);
  });
});
