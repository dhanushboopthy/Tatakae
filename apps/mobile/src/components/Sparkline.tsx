import { View } from "react-native";
import Svg, { Line, Path, Polyline } from "react-native-svg";
import type { SeriesPoint } from "@tatakae/core";
import { useTheme } from "../lib/theme";

/**
 * Sparkline + 7-day average (docs/11 C3): final score per day as a thin ink line (gaps where no
 * score), the rolling 7-day average as a lime-deep line with a lime-soft area under it. 0–100 scale.
 */
export function Sparkline(props: { points: readonly SeriesPoint[]; avg7: readonly SeriesPoint[]; height?: number; label: string }) {
  const { c } = useTheme();
  const h = props.height ?? 100;
  const W = 336;
  const n = Math.max(1, props.points.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => h - 4 - (v / 100) * (h - 8);

  const segments = (pts: readonly SeriesPoint[]) => {
    const out: string[] = [];
    let cur: string[] = [];
    pts.forEach((p, i) => {
      if (p.value == null) {
        if (cur.length) out.push(cur.join(" "));
        cur = [];
      } else cur.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    });
    if (cur.length) out.push(cur.join(" "));
    return out;
  };

  const avgPts = props.avg7.flatMap((p, i) => (p.value == null ? [] : [[x(i), y(p.value)] as const]));
  const first = avgPts[0];
  const last = avgPts.at(-1);
  const area =
    first && last && avgPts.length > 1 ? `M${first[0]},${h} ${avgPts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ")} L${last[0]},${h} Z` : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={props.label}>
      <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
        {[50, 80].map((t) => (
          <Line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />
        ))}
        {area ? <Path d={area} fill={c.limeSoft} /> : null}
        {segments(props.avg7).map((sg) => (
          <Polyline key={`a${sg}`} points={sg} fill="none" stroke={c.limeDeep} strokeWidth={2.5} />
        ))}
        {segments(props.points).map((sg) => (
          <Polyline key={`p${sg}`} points={sg} fill="none" stroke={c.ink} strokeWidth={1.5} />
        ))}
      </Svg>
    </View>
  );
}
