import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Blocker } from "@tatakae/core";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
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
  const s = useStyles(makeStyles);
  return (
    <View style={s.list} accessibilityRole="radiogroup" accessibilityLabel="What is in the way?">
      {BLOCKERS.map((b, i) => (
        <Pressable
          key={b.blocker}
          onPress={() => {
            tapSelect();
            onPick(b.blocker);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${b.title}. ${b.line}`}
          style={({ pressed }) => [s.choice, i === 0 ? s.lavender : i === 1 ? s.limeSoft : s.plain, pressed && pressedStyle]}
        >
          <Text style={[s.title, i < 2 && s.onFill]}>{b.title}</Text>
          <Text style={[s.line, i < 2 && s.onFillMuted]}>{b.line}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    list: { gap: space(1.25) },
    choice: { minHeight: minTarget * 2, justifyContent: "center", gap: 4, paddingHorizontal: space(2.5), paddingVertical: space(2), borderRadius: radius.card },
    lavender: { backgroundColor: c.lavender },
    limeSoft: { backgroundColor: c.limeSoft },
    plain: { backgroundColor: c.surface2 },
    title: { ...f(600, 19, 25), color: c.ink },
    line: { ...f(500, 14, 20), color: c.ink2 },
    onFill: { color: c.onFill },
    onFillMuted: { color: c.onFillMuted },
  });
