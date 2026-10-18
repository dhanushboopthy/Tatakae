import { StyleSheet, View } from "react-native";
import type { MetricBox, MetricKey } from "@tatakae/core";
import { space } from "../theme";
import { MetricCard } from "./MetricCard";

/**
 * Scoreboard boxes (docs/11 §2) two per row: Today shows 2 (Today's score, Days shown up), the
 * Calendar tab 4. Boxes keep the order of `keys`; a missing key is skipped.
 */
export function Scoreboard(props: { boxes: readonly MetricBox[]; keys: readonly MetricKey[]; tone?: "surface" | "surface2" }) {
  const picked = props.keys.map((k) => props.boxes.find((b) => b.key === k)).filter((b): b is MetricBox => b !== undefined);
  const rows: MetricBox[][] = [];
  for (let i = 0; i < picked.length; i += 2) rows.push(picked.slice(i, i + 2));
  return (
    <View style={styles.wrap}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((b, j) => (
            <MetricCard key={b.key} box={b} tone={props.tone} bar={(i * 2 + j) % 2 === 1 ? "lavender" : "lime"} />
          ))}
          {row.length === 1 ? <View style={styles.flex} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.25) },
  row: { flexDirection: "row", gap: space(1.25) },
  flex: { flex: 1 },
});
