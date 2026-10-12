import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, minTarget, radius, space, tnum, type } from "../theme";
import { tapSelect } from "../haptics";

export interface ChoiceProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}

/** Segmented single choice (25/50/90, on/off). Selected = paper border + ✓ glyph, not colour alone. */
export function Choice<T extends string | number>({ options, value, onChange, accessibilityLabel }: ChoiceProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tapSelect();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.label, tnum, selected && styles.labelSelected]}>
              {selected ? "✓ " : ""}
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space(1) },
  option: {
    flex: 1,
    minHeight: minTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ink3,
    paddingHorizontal: space(1),
  },
  selected: { borderColor: colors.paper, borderWidth: 2, backgroundColor: colors.ink2 },
  pressed: { opacity: 0.8 },
  label: { color: colors.muted, fontSize: type.body, fontWeight: "600" },
  labelSelected: { color: colors.paper },
});
