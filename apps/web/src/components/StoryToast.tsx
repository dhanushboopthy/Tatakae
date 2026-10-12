import { useEffect, useRef, useState } from "react";
import type { StoryRef } from "@tatakae/core";
import { useSettings } from "../lib/hooks";
import { fileUrl } from "../lib/rest";
import { muteStory, onStory, storyLine } from "../lib/story";
import { StoryIcon } from "./icons";

/**
 * The owner's picture for a story title (settings.story_pictures → /api/files/:id), cropped square.
 * Falls back to the sparkle icon when there is none or it can't load (offline). Decorative: the
 * text beside it names the title.
 */
export function StoryPicture({ title, size = 48, className = "" }: { title: string; size?: number; className?: string }) {
  const { data: s } = useSettings();
  const id = s?.story_pictures[title];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!id || failed) {
    return (
      <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-card-inner bg-surface-2 ${className}`} style={{ width: size, height: size }}>
        <StoryIcon size={Math.round(size * 0.4)} className="text-lavender-deep" />
      </span>
    );
  }
  return (
    <img
      src={fileUrl(id)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-card-inner object-cover object-top ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Subtle story card (docs/10 §5): small surface card with a lavender left bar, the title's picture
 * (when the owner added one), one line of text, slides up near the bottom. Click the line to dismiss;
 * "Mute" hides that reference for good.
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
        <StoryPicture title={s.title} />
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
