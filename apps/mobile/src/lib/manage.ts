import { useQuery } from "@tanstack/react-query";
import {
  EDITABLE_FROM,
  newId,
  type Anchor,
  type Habit,
  type RechargeItem,
  type ScoringSettings,
  type WatchQueueItem,
} from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, remove, write } from "../sync/engine";
import { saveArea } from "./reviews";

// Settings the website edits that the phone now edits too: anchors, habits, areas, the recharge menu, the reward queue
// and the scoring constants. Everything goes through the outbox (works offline); the server guards scoring.

// ---------- anchors ----------

export async function saveAnchor(a: Omit<Anchor, "id" | "updatedAt" | "deletedAt"> & { id?: string }): Promise<void> {
  await write("anchors", { ...a, id: a.id ?? newId() });
}

export async function removeAnchor(id: string): Promise<void> {
  await remove("anchors", id);
}

// ---------- habits ----------

export function useAllHabits() {
  return useQuery({
    queryKey: [LOCAL, ["habits"], "habits-all"],
    queryFn: async (): Promise<Habit[]> => (await store.getAll("habits")).filter((h) => h.deletedAt == null).sort((a, b) => a.behaviour.localeCompare(b.behaviour)),
  });
}

export async function saveHabit(h: Partial<Habit> & { behaviour: string }): Promise<void> {
  await write("habits", {
    id: h.id ?? newId(),
    anchor: h.anchor ?? null,
    behaviour: h.behaviour,
    minimum: h.minimum ?? null,
    frequency: h.frequency ?? "daily",
    areaId: h.areaId ?? null,
    active: h.active ?? true,
  });
}

export async function removeHabit(id: string): Promise<void> {
  await remove("habits", id);
}

// ---------- areas ----------

export { saveArea };

export async function removeArea(id: string): Promise<void> {
  await remove("areas", id);
}

// ---------- recharge menu ----------

export async function saveRecharge(r: { id?: string; name: string; kind?: string | null }): Promise<void> {
  await write("recharge_items", { id: r.id ?? newId(), name: r.name.trim(), kind: r.kind ?? null });
}

export async function removeRecharge(id: string): Promise<void> {
  await remove("recharge_items", id);
}

export type { RechargeItem };

// ---------- reward queue ----------

export async function saveWatch(w: Omit<WatchQueueItem, "updatedAt" | "deletedAt">): Promise<void> {
  await write("watch_queue", w);
}

export async function removeWatch(title: string): Promise<void> {
  await remove("watch_queue", title);
}

// ---------- scoring ----------

/** The scoring constants. The server only accepts them on even-week Sundays (core canEditScoring). */
export async function saveScoring(value: ScoringSettings): Promise<void> {
  await write("settings", { key: "scoring", value: JSON.stringify(value), editableFrom: EDITABLE_FROM.scoring ?? null });
}
