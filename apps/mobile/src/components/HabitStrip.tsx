import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HabitToday } from "../lib/hooks";
import { colors, minTarget, legacyRadius, space, text, type } from "../theme";
import { tapLight } from "../haptics";

export interface HabitStripProps {
  items: readonly HabitToday[];
  onToggle: (habitId: string, done: boolean) => void;
}

/** Habits are tracked, not scored: one tap each, ✓ or ○ plus the name. */
export function HabitStrip({ items, onToggle }: HabitStripProps) {
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={text.label}>Habits · tracked, not scored</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map(({ habit, done }) => (
          <Pressable
            key={habit.id}
            onPress={() => {
              tapLight();
              onToggle(habit.id, !done);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={habit.minimum ? `${habit.behaviour}. Minimum: ${habit.minimum}` : habit.behaviour}
            style={({ pressed }) => [styles.pill, done && styles.pillDone, pressed && styles.pressed]}
          >
            <Text style={[styles.glyph, done && styles.glyphDone]}>{done ? "✓" : "○"}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {habit.behaviour}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1) },
  row: { gap: space(1), paddingRight: space(2) },
  pill: {
    minHeight: minTarget,
    maxWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space(1.5),
    borderRadius: legacyRadius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ink2,
  },
  pillDone: { backgroundColor: colors.jadeSoft, borderColor: colors.jade },
  pressed: { opacity: 0.8 },
  glyph: { color: colors.muted, fontSize: type.body, fontWeight: "700" },
  glyphDone: { color: colors.jade },
  label: { color: colors.paper, fontSize: type.small, fontWeight: "500" },
});
