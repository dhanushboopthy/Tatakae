import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { f } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";

/**
 * Ring with a number in the middle (docs/10 §5): 56 ring, 6 stroke, filled clockwise from the top.
 * Per cycle goal on Cycle; also the centre of the fitness rings. `color` = the deep variant (≥ 3:1).
 */
export function RingProgress(props: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  /** Centre text; defaults to "NN%". */
  centre?: ReactNode;
  accessibilityLabel: string;
}) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const size = props.size ?? 56;
  const stroke = props.stroke ?? 6;
  const p = Math.max(0, Math.min(100, Number.isFinite(props.pct) ? props.pct : 0));
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={props.color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * len} ${len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.centre]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {props.centre ?? <Text style={s.pct}>{Math.round(p)}</Text>}
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    centre: { alignItems: "center", justifyContent: "center" },
    pct: { ...f(600, 15), color: c.ink, fontVariant: ["tabular-nums"] },
  });
