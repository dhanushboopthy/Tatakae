import type { StoryMoment, StoryRef } from "./types";

// Story layer rotation. Rules: ~1 in 3 completions, never on morning screen,
// no repeat within 14 days, skip muted, respect global "story off".

export const STORY_CHANCE = 1 / 3;
export const NO_REPEAT_DAYS = 14;

export function pickStory(
  refs: StoryRef[],
  moment: StoryMoment,
  recentlyShownIds: string[],
  rand: () => number = Math.random,
): StoryRef | null {
  // TODO(v2)
  throw new Error("not implemented");
}

/** Monthly theme by YYYY-MM (user-editable later). */
export const MONTHLY_THEMES: Record<string, string> = {
  "2026-10": "Terraform",
  "2026-11": "Kubernetes",
  "2026-12": "AWS SAA",
};
