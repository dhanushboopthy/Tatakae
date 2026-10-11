import { compareIso } from "./sync";
import type { ISODate, StoryMoment, StoryRef } from "./types";

// Story layer rotation. Rules: ~1 in 3 completions, never on morning screen,
// no repeat within 14 days, skip muted, respect global "story off".
// The caller handles "morning screen" and the `story_enabled` setting; this only picks.

export const STORY_CHANCE = 1 / 3;
export const NO_REPEAT_DAYS = 14;

/** The fields pickStory needs; full StoryRef rows satisfy it. */
export type PickableStory = Pick<StoryRef, "id" | "moment" | "muted"> & { deletedAt?: string | null };

/**
 * Pick a story for `moment`, or null. Consumes rand() once for the 1-in-3 roll (rand() < 1/3 shows),
 * then once more for a uniform pick among refs that match the moment, are not muted, not deleted
 * and not in recentlyShownIds.
 */
export function pickStory<T extends PickableStory>(
  refs: readonly T[],
  moment: StoryMoment,
  recentlyShownIds: readonly string[],
  rand: () => number = Math.random,
): T | null {
  if (rand() >= STORY_CHANCE) return null;
  const recent = new Set(recentlyShownIds);
  const eligible = refs.filter((r) => r.moment === moment && !r.muted && r.deletedAt == null && !recent.has(r.id));
  if (eligible.length === 0) return null;
  const i = Math.min(eligible.length - 1, Math.floor(rand() * eligible.length));
  return eligible[i] ?? null;
}

/** Ids shown within the last NO_REPEAT_DAYS (by `lastShownAt`), to pass as recentlyShownIds. */
export function recentlyShownIds(
  refs: readonly Pick<StoryRef, "id" | "lastShownAt">[],
  now: Date = new Date(),
): string[] {
  const cutoff = new Date(now.getTime() - NO_REPEAT_DAYS * 86_400_000).toISOString();
  return refs.filter((r) => r.lastShownAt != null && compareIso(r.lastShownAt, cutoff) > 0).map((r) => r.id);
}

/** Monthly theme by YYYY-MM (user-editable later). */
export const MONTHLY_THEMES: Record<string, string> = {
  "2026-10": "Terraform",
  "2026-11": "Kubernetes",
  "2026-12": "AWS SAA",
};

/** Theme for the month containing `date`, or null. */
export function themeFor(date: ISODate): string | null {
  return MONTHLY_THEMES[date.slice(0, 7)] ?? null;
}
