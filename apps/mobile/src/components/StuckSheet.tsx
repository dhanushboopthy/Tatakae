import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Blocker } from "@tatakae/core";
import { colors, minTarget, radius, space, text, type } from "../theme";
import { tapSelect } from "../haptics";

export const BLOCKERS: readonly { blocker: Blocker; title: string; line: string }[] = [
  { blocker: "uncertainty", title: "Uncertainty", line: "You're not sure what the next step is." },
  { blocker: "fear", title: "Fear", line: "You're worried about how it will go." },
  { blocker: "inertia", title: "Inertia", line: "You know what to do. Starting is the hard part." },
];

export interface StuckSheetProps {
  onPick: (b: Blocker) => void;
}

/** Three big choices, no lecture. The follow-up (field or timer) lives on the Stuck screen. */
export function StuckSheet({ onPick }: StuckSheetProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="What is in the way?">
      {BLOCKERS.map((b) => (
        <Pressable
          key={b.blocker}
          onPress={() => {
            tapSelect();
            onPick(b.blocker);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${b.title}. ${b.line}`}
          style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
        >
          <Text style={styles.title}>{b.title}</Text>
          <Text style={text.small}>{b.line}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space(1.5) },
  choice: {
    minHeight: minTarget * 2,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  pressed: { backgroundColor: colors.ink3 },
  title: { color: colors.paper, fontSize: type.h2, fontWeight: "600" },
});
