import { nowIso, pickStory, readSettings, recentlyShownIds, type StoryMoment, type StoryRef } from "@tatakae/core";
import { store, write } from "../sync/engine";

// Story layer (docs/02, docs/05): after a completion, ~1 in 3 chance of one line from the owner's pack.
// Never on the morning screen, never twice in 14 days, muted refs skipped, off when story_enabled is false.
// Screens call announceMoment(); the StoryToastHost in the Shell shows the pick.

const EVENT = "tatakae:story";

export interface StoryEventDetail {
  story: StoryRef;
}

/** Roll for a story at `moment`; if one is picked, stamp lastShownAt and show it. */
export async function announceMoment(moment: StoryMoment, rand: () => number = Math.random): Promise<StoryRef | null> {
  try {
    const [refs, settingRows] = await Promise.all([store.getAll("story_refs"), store.getAll("settings")]);
    if (!readSettings(settingRows).story_enabled || refs.length === 0) return null;
    const pick = pickStory(refs, moment, recentlyShownIds(refs), rand);
    if (!pick) return null;
    const shown = await write("story_refs", { ...pick, lastShownAt: nowIso() });
    window.dispatchEvent(new CustomEvent<StoryEventDetail>(EVENT, { detail: { story: shown } }));
    return shown;
  } catch {
    return null; // the story layer never gets in the way
  }
}

export function onStory(listener: (story: StoryRef) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<StoryEventDetail>).detail;
    if (detail?.story) listener(detail.story);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** "<Character>, <Title> — <lesson>" (the one-line format from docs/05). */
export function storyLine(s: Pick<StoryRef, "character" | "title" | "lesson">): string {
  return `${s.character ? `${s.character}, ` : ""}${s.title} — ${s.lesson}`;
}

export async function muteStory(story: StoryRef): Promise<void> {
  const current = (await store.get("story_refs", story.id)) ?? story;
  await write("story_refs", { ...current, muted: true });
}
