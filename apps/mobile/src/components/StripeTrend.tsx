import { StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import type { ISODate, SeriesPoint } from "@tatakae/core";
import { f } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";
import { shortDate } from "../lib/format";

/**
 * Stripe trend (docs/11 C2, ref 01): dense vertical lines forming an area, three per day, interpolated
 * between days. Coloured by band: ≤ free lime-deep, ≤ free + 60 butter, above grey (never red). Dashed
 * line at the free allowance. Gaps where no number was entered. `label` is the spoken summary.
 */
export function StripeTrend(props: { points: readonly SeriesPoint[]; today: ISODate; free?: number; height?: number; label: string }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const free = props.free ?? 120;
  const h = props.height ?? 120;
  const W = 336;
  const vals = props.points.map((p) => p.value).filter((v): v is number => v != null);
  const max = Math.max(free * 2, ...vals) * 1.05;
  const y = (v: number) => h - (v / max) * h;
  const per = 3;
  const n = Math.max(1, props.points.length);
  const step = W / (n * per);
  const color = (v: number) => (v <= free ? c.limeDeep : v <= free + 60 ? c.butter : c.missed);

  const lines: { x: number; v: number }[] = [];
  props.points.forEach((p, i) => {
    if (p.value == null) return;
    const next = props.points[i + 1]?.value ?? p.value;
    for (let k = 0; k < per; k++) lines.push({ x: (i * per + k + 0.5) * step, v: p.value + (next - p.value) * (k / per) });
  });

  const first = props.points[0]?.date;
  const last = props.points.at(-1)?.date;
  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={props.label}>
        <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
          <Line x1={0} x2={W} y1={y(free)} y2={y(free)} stroke={c.ink} strokeWidth={1} strokeDasharray="4 5" opacity={0.5} />
          {lines.map((l) => (
            <Line key={l.x} x1={l.x} x2={l.x} y1={h} y2={Math.min(h - 2, y(l.v))} stroke={color(l.v)} strokeWidth={2.5} strokeLinecap="round" />
          ))}
        </Svg>
      </View>
      <View style={s.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={s.tick}>{first ? shortDate(first) : ""}</Text>
        <Text style={s.tick}>{last === props.today ? "Today" : last ? shortDate(last) : ""}</Text>
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    tick: { ...f(500, 12, 16), color: c.ink2 },
  });
