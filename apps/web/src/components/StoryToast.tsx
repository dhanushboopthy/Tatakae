import { useEffect, useRef, useState } from "react";
import type { StoryRef } from "@tatakae/core";
import { muteStory, onStory, storyLine } from "../lib/story";
import { StoryIcon } from "./icons";

/**
 * Subtle story card (docs/10 §5): small surface card with a lavender left bar, one line of text, slides
 * up near the bottom. Click the line to dismiss; "Mute" hides that reference for good. Text only.
 */
export function StoryToast(props: { story: StoryRef | null; onDismiss: () => void; onMute?: () => void }) {
  const s = props.story;
  if (!s) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex max-w-lg animate-rise items-stretch overflow-hidden rounded-card-inner bg-surface shadow-float"
    >
      <span aria-hidden="true" className="w-1.5 shrink-0 bg-lavender" />
      <button type="button" onClick={props.onDismiss} className="flex flex-1 items-start gap-3 px-4 py-3 text-left" aria-label={`${storyLine(s)}. Dismiss.`}>
        <StoryIcon size={18} className="mt-0.5 shrink-0 text-lavender-deep" />
        <span className="text-sm">
          <span className="font-semibold">{s.character ? `${s.character}, ` : ""}</span>
          <span className="italic">{s.title}</span> — {s.lesson}
          {s.yourLine && <span className="mt-1 block text-ink-2">{s.yourLine}</span>}
        </span>
      </button>
      {props.onMute && (
        <button type="button" onClick={props.onMute} className="shrink-0 px-4 text-xs font-semibold text-ink-2 hover:text-ink">
          Mute
        </button>
      )}
    </div>
  );
}

/** Mounted once in the Shell: shows stories announced via lib/story announceMoment(). */
export function StoryToastHost() {
  const [story, setStory] = useState<StoryRef | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const off = onStory((s) => {
      setStory(s);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStory(null), 9000);
    });
    return () => {
      off();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!story) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <StoryToast
        story={story}
        onDismiss={() => setStory(null)}
        onMute={() => {
          void muteStory(story);
          setStory(null);
        }}
      />
    </div>
  );
}
