import { StyleSheet, Text, View } from "react-native";
import { colors, space, tnum, type } from "../theme";

/** Cumulative count that never resets. Not a streak: no flame, no "current run". */
export function DaysShownUp({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  const label = count === 1 ? "day shown up" : "days shown up";
  return (
    <View style={styles.row} accessible accessibilityLabel={`${count} ${label} so far`}>
      <Text style={[styles.count, tnum]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: space(1) },
  count: { color: colors.paper, fontSize: type.h2, fontWeight: "600" },
  label: { color: colors.muted, fontSize: type.small },
});
