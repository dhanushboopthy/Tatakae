import { Pressable, StyleSheet, Text, View } from "react-native";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
import { tapSelect } from "../haptics";
import { Icon } from "./Icon";

/**
 * Day / Week / Month (or 25 · 50 · 90) pills: selected = lime fill with ink text and a ✓, others
 * surface-2 (docs/10 §5). The ✓ keeps the choice readable without colour.
 */
export function SegmentedPills<T extends string | number>(props: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
  /** Stretch each pill to fill the row. */
  stretch?: boolean;
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={props.accessibilityLabel}>
      {props.options.map((o) => {
        const selected = o.value === props.value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tapSelect();
              props.onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [s.pill, props.stretch && s.stretch, selected && s.selected, pressed && pressedStyle]}
          >
            {selected ? <Icon name="done" color={s.labelSelected.color} size={16} strokeWidth={2.25} /> : null}
            <Text style={[s.label, selected && s.labelSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: space(1) },
    pill: {
      minHeight: minTarget,
      minWidth: minTarget,
      paddingHorizontal: space(2),
      borderRadius: radius.pill,
      backgroundColor: c.surface2,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 4,
    },
    stretch: { flex: 1 },
    selected: { backgroundColor: c.lime },
    label: { ...f(600, 14), color: c.ink, fontVariant: ["tabular-nums"] },
    labelSelected: { color: c.onFill },
  });
