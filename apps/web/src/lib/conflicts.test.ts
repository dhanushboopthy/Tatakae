import { describe, expect, it } from "vitest";
import type { OutboxItem, SyncConflictEvent } from "@tatakae/core";
import { conflictMessage, describeConflict } from "./conflicts";

const item = (updatedAt: string, table: OutboxItem["table"] = "missions"): OutboxItem => ({
  id: "item-1",
  table,
  op: "upsert",
  row: table === "days" ? { date: "2026-10-20", updatedAt } : { id: "m1", updatedAt },
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
  });
  it("undone when the server has no row", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z"), null))?.kind).toBe("undone");
  });
  it("uses the table's primary key", () => {
    expect(describeConflict(ev(item("2026-10-20T08:00:00Z", "days"), null))?.pk).toBe("2026-10-20");
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
});
