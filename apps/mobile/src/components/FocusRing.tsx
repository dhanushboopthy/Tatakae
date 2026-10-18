import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../lib/theme";

/**
 * Focus countdown ring (docs/11 C11): a thick lime ring on white with a lime-deep edge so it reads
 * at 3:1; the elapsed part fills clockwise from the top. Static (no animation); the clock inside
 * is the children.
 */
export function FocusRing(props: { progress: number; size?: number; accessibilityLabel: string; children?: ReactNode }) {
  const { c } = useTheme();
  const size = props.size ?? 280;
  const stroke = 16;
  const p = Math.min(1, Math.max(0, Number.isFinite(props.progress) ? props.progress : 0));
  const r = (size - stroke) / 2 - 1;
  const len = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <>
            <Circle
              cx={mid}
              cy={mid}
              r={r}
              stroke={c.limeDeep}
              strokeWidth={stroke + 2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${p * len} ${len}`}
              transform={`rotate(-90 ${mid} ${mid})`}
            />
            <Circle
              cx={mid}
              cy={mid}
              r={r}
              stroke={c.lime}
              strokeWidth={stroke - 2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${p * len} ${len}`}
              transform={`rotate(-90 ${mid} ${mid})`}
            />
          </>
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
});
