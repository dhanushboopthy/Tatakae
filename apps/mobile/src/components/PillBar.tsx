import { StyleSheet, Text, View } from "react-native";
import { f, radius, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";

/** One long pill split into labelled parts (docs/11 C8), e.g. stuck: Uncertainty / Fear / Inertia. */
export function PillBar(props: { parts: readonly { label: string; value: number; fill: string; deep: string }[]; label: string; empty?: string }) {
  const s = useStyles(makeStyles);
  const total = props.parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return <Text style={s.legend}>{props.empty ?? "Nothing yet."}</Text>;
  return (
    <View style={s.wrap}>
      <View style={s.bar} accessible accessibilityRole="image" accessibilityLabel={props.label}>
        {props.parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <View key={p.label} style={[s.part, { flex: p.value, backgroundColor: p.fill, borderColor: p.deep }]}>
              <Text style={s.num}>{p.value}</Text>
            </View>
          ))}
      </View>
      <View style={s.legendRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {props.parts.map((p) => (
          <View key={p.label} style={s.item}>
            <View style={[s.dot, { backgroundColor: p.fill, borderColor: p.deep }]} />
            <Text style={s.legend}>
              {p.label} <Text style={s.legendNum}>{p.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    bar: { flexDirection: "row", height: 40, gap: 4, borderRadius: radius.pill, overflow: "hidden" },
    part: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 6 },
    num: { ...f(600, 14), color: c.onFill, fontVariant: ["tabular-nums"] },
    legendRow: { flexDirection: "row", flexWrap: "wrap", columnGap: space(2), rowGap: 4 },
    item: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
    legend: { ...f(500, 13, 18), color: c.ink2 },
    legendNum: { ...f(600, 13, 18), color: c.ink },
  });
