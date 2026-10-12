import { Pressable, StyleSheet, Text } from "react-native";
import { colors, legacyRadius, space, text, type } from "../theme";

export interface StoryLine {
  id: string;
  character: string | null;
  title: string;
  lesson: string;
  yourLine: string | null;
}

export interface StoryToastProps {
  story: StoryLine | null;
  onDismiss: () => void;
  /** Long-press mutes this reference (v2). */
  onMute?: (id: string) => void;
}

/**
 * One paraphrased line after a completion: "<Character>, <Title> — <lesson>". Text only.
 * Rendering only for now; v2 wires pickStory (core) + story_enabled + mute. Never on Morning.
 */
export function StoryToast({ story, onDismiss, onMute }: StoryToastProps) {
  if (!story) return null;
  const who = story.character ? `${story.character}, ${story.title}` : story.title;
  return (
    <Pressable
      onPress={onDismiss}
      onLongPress={onMute ? () => onMute(story.id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${who}: ${story.lesson}`}
      accessibilityHint={onMute ? "Tap to dismiss. Long-press to mute this reference" : "Tap to dismiss"}
      accessibilityLiveRegion="polite"
      style={styles.toast}
    >
      <Text style={styles.who}>{who}</Text>
      <Text style={text.body}>{story.lesson}</Text>
      {story.yourLine ? <Text style={text.small}>{story.yourLine}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    backgroundColor: colors.ink2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: legacyRadius.card,
    padding: space(2),
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  who: { color: colors.muted, fontSize: type.small, fontWeight: "600" },
});
