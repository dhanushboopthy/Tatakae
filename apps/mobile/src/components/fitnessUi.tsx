import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { f, light, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../lib/theme";
import { tapLight } from "../haptics";

// Small building blocks for the Fitness phone screens (Today card, Log body, Log food, Log set).
// Pastel fills are the same in both themes and always carry ink text (`fill.ink`).

export { SheetHeader } from "./Screen";

export const fill = {
  rose: light.area.rose,
  roseDeep: "#E57FB8",
  lime: light.lime,
  limeSoft: light.limeSoft,
  lavenderSoft: light.lavenderSoft,
  white: "#FFFFFF",
  ink: light.onFill,
  inkMuted: light.onFillMuted,
} as const;

/** Pill button, 44dp tall. `tone` picks a pastel fill (ink text on every one), surface-2 or the charcoal primary. */
export function PillButton(props: {
  label: string;
  onPress: () => void;
  tone?: "white" | "lime" | "lavender" | "neutral" | "primary";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const tone = props.tone ?? "neutral";
  const bg = { white: fill.white, lime: fill.lime, lavender: fill.lavenderSoft, neutral: c.surface2, primary: c.hero }[tone];
  const fg = tone === "neutral" ? c.ink : tone === "primary" ? c.onHero : fill.ink;
  return (
    <Pressable
      onPress={() => {
        tapLight();
        props.onPress();
      }}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: props.disabled === true }}
      style={({ pressed }) => [s.pill, { backgroundColor: bg }, props.flex && s.flex, pressed && pressedStyle, props.disabled && s.disabled, props.style]}
    >
      <Text style={[s.pillLabel, { color: fg }]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Round − / + buttons around a value, 52dp each. `light` = white circles on a pastel card. */
export function Stepper(props: { value: ReactNode; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; tone?: "light" | "dark" }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const onCard = props.tone === "light";
  const bg = onCard ? fill.white : c.surface2;
  const fg = onCard ? fill.ink : c.ink;
  const button = (glyph: string, label: string, onPress: () => void) => (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.round, { backgroundColor: bg }, pressed && pressedStyle]}
    >
      <Text style={[s.roundGlyph, { color: fg }]}>{glyph}</Text>
    </Pressable>
  );
  return (
    <View style={s.stepper}>
      {button("−", props.minusLabel, props.onMinus)}
      {props.value}
      {button("+", props.plusLabel, props.onPlus)}
    </View>
  );
}

/** Thin progress bar; the number next to it always says the same thing, so colour is never the only signal. */
export function MiniBar(props: { pct: number; track?: string; color: string; label: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const p = Math.max(0, Math.min(100, Math.round(props.pct)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: 100, now: p }}
      style={[s.bar, { backgroundColor: props.track ?? c.line }, props.style]}
    >
      <View style={[s.barFill, { width: `${p}%`, backgroundColor: props.color }]} />
    </View>
  );
}

/** 1240 → "1,240". */
export const n0 = (n: number): string => Math.round(n).toLocaleString("en-US");

/** 430 minutes → "7 h 10 m". */
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m} m` : m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** Parse a typed number ("1,240", " 2.5 "): null when empty or not a finite non-negative number. */
export function parseNum(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const makeStyles = (_: Theme) =>
  StyleSheet.create({
    pill: { minHeight: minTarget, paddingHorizontal: space(2), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    pillLabel: { ...f(600, 14) },
    flex: { flex: 1 },
    disabled: { opacity: 0.5 },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2) },
    round: { width: 52, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    roundGlyph: { ...f(600, 26), fontVariant: ["tabular-nums"] },
    bar: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: radius.pill },
  });
