import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HabitToday } from "../lib/hooks";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../lib/theme";
import { tapLight } from "../haptics";
import { Icon } from "./Icon";

export interface HabitStripProps {
  items: readonly HabitToday[];
  onToggle: (habitId: string, done: boolean) => void;
}

/** Habits are tracked, not scored: one tap each, lime with ✓ when done, surface-2 with ○ when not. */
export function HabitStrip({ items, onToggle }: HabitStripProps) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Habits · tracked, not scored</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
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
            style={({ pressed }) => [s.pill, done && s.pillDone, pressed && pressedStyle]}
          >
            {done ? <Icon name="done" size={16} color={c.onFill} strokeWidth={2.25} /> : <Text style={s.open}>○</Text>}
            <Text style={[s.label, done && s.labelDone]} numberOfLines={1}>
              {habit.behaviour}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    title: { ...f(600, 13, 18), color: c.ink2 },
    row: { gap: space(1), paddingRight: space(2) },
    pill: {
      minHeight: minTarget,
      maxWidth: 240,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: space(1.75),
      borderRadius: radius.pill,
      backgroundColor: c.surface2,
    },
    pillDone: { backgroundColor: c.lime },
    open: { ...f(700, 15), color: c.ink2 },
    label: { ...f(600, 14), color: c.ink },
    labelDone: { color: c.onFill },
  });
