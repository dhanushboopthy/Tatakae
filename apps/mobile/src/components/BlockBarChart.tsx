import { StyleSheet, Text, View } from "react-native";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";

export interface BlockSeries {
  key: string;
  label: string;
  fill: string;
  deep: string;
}

/**
 * Block bar chart (docs/11 C6, ref 05): columns of rounded blocks stacked bottom-up, one block per
 * `unit` (e.g. 30 focus minutes), coloured per series (area pastels with a deep edge). Series are
 * labelled in a legend with numbers — never colour alone.
 */
export function BlockBarChart(props: {
  columns: readonly { label: string; values: Record<string, number> }[];
  series: readonly BlockSeries[];
  unit: number;
  unitLabel: string;
  label: string;
  maxBlocks?: number;
}) {
  const s = useStyles(makeStyles);
  const stacks = props.columns.map((col) =>
    props.series.flatMap((ser) => Array.from({ length: Math.ceil((col.values[ser.key] ?? 0) / props.unit) }, () => ser)),
  );
  const tallest = Math.max(1, Math.min(props.maxBlocks ?? 12, Math.max(0, ...stacks.map((b) => b.length))));
  const totals = props.series.map((ser) => ({ ser, total: props.columns.reduce((n, col) => n + (col.values[ser.key] ?? 0), 0) }));
  return (
    <View style={s.wrap}>
      <View style={s.row} accessible accessibilityRole="image" accessibilityLabel={props.label}>
        {stacks.map((stack, i) => (
          <View key={props.columns[i]?.label ?? i} style={s.col}>
            <View style={[s.stack, { height: tallest * 14 }]}>
              {stack.slice(0, tallest).map((ser, j) => (
                <View key={j} style={[s.block, { backgroundColor: ser.fill, borderColor: ser.deep }]} />
              ))}
            </View>
            <Text style={s.colLabel}>{props.columns[i]?.label}</Text>
          </View>
        ))}
      </View>
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {totals.map(({ ser, total }) => (
          <View key={ser.key} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: ser.fill, borderColor: ser.deep }]} />
            <Text style={s.legendText}>
              {ser.label} <Text style={s.legendNum}>{total}</Text>
            </Text>
          </View>
        ))}
        <Text style={s.legendText}>· one block = {props.unitLabel}</Text>
      </View>
    </View>
  );
}

/** One horizontal pill per item split by series, e.g. focus minutes by area this week. */
export function AreaSplit(props: { parts: readonly { key: string; label: string; minutes: number; fill: string; deep: string }[]; label: string }) {
  const s = useStyles(makeStyles);
  const shown = props.parts.filter((p) => p.minutes > 0);
  if (shown.length === 0) return <Text style={s.legendText}>No focus blocks yet this week.</Text>;
  return (
    <View style={s.wrap}>
      <View style={s.split} accessible accessibilityRole="image" accessibilityLabel={props.label}>
        {shown.map((p) => (
          <View key={p.key} style={[s.splitPart, { flex: p.minutes, backgroundColor: p.fill, borderColor: p.deep }]} />
        ))}
      </View>
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {shown.map((p) => (
          <Text key={p.key} style={s.legendText}>
            {p.label} <Text style={s.legendNum}>{p.minutes}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    row: { flexDirection: "row", alignItems: "flex-end", gap: space(1) },
    col: { flex: 1, alignItems: "center", gap: 6 },
    stack: { width: "100%", maxWidth: 44, flexDirection: "column-reverse", gap: 2 },
    block: { height: 12, borderRadius: 4, borderWidth: 1 },
    colLabel: { ...f(500, 12, 16), color: c.ink2 },
    legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space(1.5), rowGap: 4, alignItems: "center" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
    legendText: { ...f(500, 12, 16), color: c.ink2 },
    legendNum: { ...f(600, 12, 16), color: c.ink },
    split: { flexDirection: "row", gap: 4, height: 28 },
    splitPart: { borderRadius: 10, borderWidth: 1.5 },
  });
