import { View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import type { WeekMark } from "@tatakae/core";
import { fontFamily } from "../theme";
import { useTheme } from "../lib/theme";
import { markFill } from "../lib/colors";

/**
 * 12-segment cycle gauge (docs/11 C4, ref 04): one rounded segment per week along a half circle,
 * coloured by that week's mark (lime / lavender / lime-soft / grey for missed / hollow ahead).
 * Centre: big % (days shown up / days counted) and one word. Static (no animation on the phone).
 */
export function SegmentGauge(props: { marks: readonly WeekMark[]; pct: number | null; word: string; label: string }) {
  const { c } = useTheme();
  const W = 340;
  const H = 200;
  const cx = W / 2;
  const cy = 172;
  const r = 140;
  const n = Math.max(1, props.marks.length);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={props.label}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {props.marks.map((m, i) => {
          const theta = 180 - ((i + 0.5) * 180) / n;
          const rad = (theta * Math.PI) / 180;
          const px = cx + r * Math.cos(rad);
          const py = cy - r * Math.sin(rad);
          const { fill, stroke } = markFill(m, c);
          return (
            <G key={i} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(-theta).toFixed(1)})`}>
              <Rect x={-23} y={-14} width={46} height={28} rx={10} fill={fill} stroke={stroke} strokeWidth={m === "Strong" || m === "Solid" ? 1.5 : 2} />
            </G>
          );
        })}
        <SvgText x={cx} y={cy - 34} textAnchor="middle" fontSize={52} fontFamily={fontFamily[600]} fill={c.ink} letterSpacing={-1.5}>
          {props.pct == null ? "—" : `${props.pct}%`}
        </SvgText>
        <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontFamily={fontFamily[500]} fill={c.ink}>
          {props.word}
        </SvgText>
      </Svg>
    </View>
  );
}
