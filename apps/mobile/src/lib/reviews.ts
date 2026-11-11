import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  anchorsFor,
  appDayOf,
  freeMinutes,
  missionsOn,
  newId,
  plannedMinutes,
  readSettings,
  rewardTarget,
  type Area,
  type Experiment,
  type ISODate,
  type Review,
  type WatchQueueItem,
} from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, write } from "../sync/engine";

// Weekly and monthly reviews on the phone (website: Weekly Control Room and Monthly review). Reads come from the
// local store; every write goes through the outbox, so a review can be written offline.

export function useReviews() {
  return useQuery({
    queryKey: [LOCAL, ["reviews"], "reviews"],
    queryFn: async (): Promise<Review[]> => (await store.getAll("reviews")).filter((r) => r.deletedAt == null).sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
  });
}

export function useExperiments() {
  return useQuery({
    queryKey: [LOCAL, ["experiments"], "experiments"],
    queryFn: async (): Promise<Experiment[]> => (await store.getAll("experiments")).filter((e) => e.deletedAt == null).sort((a, b) => b.start.localeCompare(a.start)),
  });
}

/** Lock-edit reasons (mura events) whose app day falls in [from, to], newest first. */
export function useMuraEvents(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: [LOCAL, ["mura_events", "missions"], "mura", from, to],
    queryFn: async () => {
      const [events, missions] = await Promise.all([store.getAll("mura_events"), store.getAll("missions")]);
      return events
        .filter((e) => {
          const d = appDayOf(e.at);
          return d >= from && d <= to;
        })
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((e) => ({ ...e, title: missions.find((m) => m.id === e.missionId)?.title ?? "A mission" }));
    },
  });
}

/** Planned minutes vs budget per day (Muri): budget = capacityRatio × free minutes (wake → ritual − anchors). */
export function useCapacityRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: [LOCAL, ["missions", "anchors", "settings"], "capacity", from, to],
    queryFn: async () => {
      const [missions, anchors, settingRows] = await Promise.all([store.getAll("missions"), store.getAll("anchors"), store.getAll("settings")]);
      const s = readSettings(settingRows);
      const out: { date: ISODate; planned: number; budget: number }[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const free = freeMinutes({ wakeTime: s.wake_time, ritualTime: s.ritual_time, anchors: anchorsFor(anchors, d) });
        out.push({ date: d, planned: plannedMinutes(missionsOn(missions, d)), budget: Math.floor(free * s.scoring.capacityRatio) });
      }
      return out;
    },
  });
}

export function useWatchQueue() {
  return useQuery({
    queryKey: [LOCAL, ["watch_queue"], "watch-queue"],
    queryFn: async (): Promise<WatchQueueItem[]> => (await store.getAll("watch_queue")).filter((w) => w.deletedAt == null).sort((a, b) => a.title.localeCompare(b.title)),
  });
}

export type ReviewFields = Omit<Review, "id" | "updatedAt" | "deletedAt">;

/**
 * Save a review (create or update). Completing a weekly review for the first time unlocks one reward episode
 * (core rewardTarget). Returns the unlocked show's title, if any.
 */
export async function saveReview(fields: ReviewFields, existing: Review | null): Promise<string | null> {
  await write("reviews", { ...(existing ?? { id: newId() }), ...fields });
  if (existing || fields.type !== "week") return null;
  const target = rewardTarget(await store.getAll("watch_queue"));
  if (!target) return null;
  await write("watch_queue", { ...target, unlocked: target.unlocked + 1, status: target.status === "queued" ? "watching" : target.status });
  return target.title;
}

export async function saveExperiment(e: Omit<Experiment, "id" | "updatedAt" | "deletedAt"> & { id?: string }): Promise<void> {
  await write("experiments", { ...e, id: e.id ?? newId() });
}

/** Area edits (alignment score in the monthly review; the full Areas editor comes with Settings). */
export async function saveArea(a: Partial<Area> & { name: string }): Promise<Area> {
  return write("areas", { standard: null, why: null, alignmentScore: null, ...a, id: a.id ?? newId() });
}

/** "2026-10" ± n months. */
export function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
