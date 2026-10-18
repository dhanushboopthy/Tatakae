import { StyleSheet, Text, View } from "react-native";
import { capacityCheck, type ScoringSettings } from "@tatakae/core";
import { f, radius, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";

/**
 * Hara Hachi Bu (docs/11 C10): planned minutes against free minutes on a thick pill track, lime fill,
 * a tick at 80 % (capacityRatio). Above the tick the fill turns butter and a line warns — never blocks.
 * The ritual that uses it lives on the laptop; the phone shows it in the design page.
 */
export function CapacityBar(props: { plannedMin: number; freeMin: number; scoring: ScoringSettings }) {
  const s = useStyles(makeStyles);
  const { plannedMin, freeMin, scoring } = props;
  const { overCapacity, budgetMin } = capacityCheck(plannedMin, freeMin, scoring);
  const pct = freeMin > 0 ? Math.min(100, (plannedMin / freeMin) * 100) : plannedMin > 0 ? 100 : 0;
  const line = Math.round(scoring.capacityRatio * 100);
  const summary = `Planned ${plannedMin} min of a ${budgetMin} min budget (${line} % of ${freeMin} free minutes).`;
  const warn = overCapacity && plannedMin > 0;
  return (
    <View style={s.wrap}>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Capacity" accessibilityValue={{ text: summary }}>
        <View style={[s.fill, warn ? s.warn : s.ok, { width: `${pct}%` }]} />
        <View style={[s.tick, { left: `${line}%` }]} />
      </View>
      <Text style={s.small}>{summary}</Text>
      {warn ? <Text style={s.note}>Over {line} % of your free time. Fine if you mean it — or drop one.</Text> : null}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    track: { height: 24, borderRadius: radius.pill, backgroundColor: c.surface2, justifyContent: "center" },
    fill: { height: "100%", borderRadius: radius.pill, borderWidth: 1.5 },
    ok: { backgroundColor: c.lime, borderColor: c.limeDeep },
    warn: { backgroundColor: c.butter, borderColor: c.butterDeep },
    tick: { position: "absolute", top: -4, bottom: -4, width: 2, borderRadius: 1, backgroundColor: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2, fontVariant: ["tabular-nums"] },
    note: { ...f(600, 14, 20), color: c.ink },
  });
