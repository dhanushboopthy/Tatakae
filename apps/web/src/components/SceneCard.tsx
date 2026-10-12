import { pickScene, type Scene } from "@tatakae/core";
import { useSettings, useStoryRefs, useToday } from "../lib/hooks";
import { StoryPicture } from "./StoryToast";

/**
 * Scene card: one line from the owner's pack with the show's picture, chosen for this screen's job
 * (core SCENE_MOMENTS) and rotating daily (core pickScene). Off with Settings → Story; hidden when
 * nothing fits. Calm screens show it under the header; action screens at the foot, below the work.
 * Never on Morning or Login.
 */
export function SceneCard({ scene, size = "md", className = "" }: { scene: Scene; size?: "md" | "sm"; className?: string }) {
  const today = useToday();
  const { data: s } = useSettings();
  const { data: refs = [] } = useStoryRefs();
  const ref = s?.story_enabled === false ? null : pickScene(refs, scene, today);
  if (!ref) return null;
  const sm = size === "sm";
  return (
    <figure
      className={`m-0 flex items-center gap-4 rounded-card-inner border-l-4 border-lavender ${sm ? "bg-surface-2 p-3" : "bg-surface p-4"} ${className}`}
    >
      <StoryPicture title={ref.title} size={sm ? 56 : 88} />
      <figcaption className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-ink-2">
          {ref.character ? `${ref.character} · ` : ""}
          <cite className="not-italic">{ref.title}</cite>
        </p>
        <p className={`font-semibold ${sm ? "text-sm" : "leading-snug"}`}>{ref.lesson}</p>
        {ref.yourLine && <p className="text-sm text-ink-2">{ref.yourLine}</p>}
      </figcaption>
    </figure>
  );
}
