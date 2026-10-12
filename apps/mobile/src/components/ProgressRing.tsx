import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

export interface ProgressRingProps {
  /** 0 … 1 */
  progress: number;
  size?: number;
  /** Number of ticks around the ring. */
  ticks?: number;
  /** Spoken summary, e.g. "12 minutes left". */
  accessibilityLabel: string;
  children?: ReactNode;
}

/**
 * Countdown ring without react-native-svg: a circle of small ticks, filled clockwise from the top.
 * Filled ticks are ember (3:1+ on ink); remaining ticks use line-strong. Static, no animation.
 */
export function ProgressRing({ progress, size = 280, ticks = 60, accessibilityLabel, children }: ProgressRingProps) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const filled = Math.round(p * ticks);
  const tick = Math.max(4, Math.round(size / 45));
  const r = size / 2 - tick;
  const c = size / 2;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              {
                width: tick,
                height: tick,
                borderRadius: tick / 2,
                left: c + r * Math.cos(a) - tick / 2,
                top: c + r * Math.sin(a) - tick / 2,
                backgroundColor: i < filled ? colors.ember : colors.lineStrong,
              },
            ]}
          />
        );
      })}
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

/** Thin horizontal variant for small places (Recharge timer). */
export function ProgressBar({ progress, accessibilityLabel }: { progress: number; accessibilityLabel: string }) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      style={styles.bar}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <View style={[styles.fill, { width: `${p * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.ink3, borderWidth: 1, borderColor: colors.lineStrong, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.ember },
});
