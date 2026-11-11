import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, legacyRadius, light, minTarget, space, tnum, type } from "../theme";
import { tapLight } from "../haptics";

// Small building blocks for the Fitness phone screens (Today card, Log body, Log food, Log set).
// Pastel fills always carry ink text (`fill.ink`); on the dark screens the neutral surfaces use the app's tokens.

export const fill = {
  rose: light.area.rose,
  lime: light.lime,
  limeSoft: light.limeSoft,
  lavenderSoft: light.lavenderSoft,
  white: "#FFFFFF",
  ink: light.ink,
  inkMuted: "#4A4A50", // 8.8:1 on rose and 8.6:1 on lime-soft
} as const;

/** Sheet title row with a 44dp close button. */
export function SheetHeader(props: { title: string; subtitle?: string; onClose: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">
          {props.title}
        </Text>
        {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
      </View>
      {props.right}
      <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>
    </View>
  );
}

/** Pill button, 44dp tall. `tone` picks the pastel fill (ink text on every one) or the neutral dark surface. */
export function PillButton(props: {
  label: string;
  onPress: () => void;
  tone?: "white" | "lime" | "lavender" | "neutral" | "primary";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const tone = props.tone ?? "neutral";
  const bg = { white: fill.white, lime: fill.lime, lavender: fill.lavenderSoft, neutral: colors.ink3, primary: colors.ember }[tone];
  const fg = tone === "neutral" ? colors.paper : fill.ink;
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
      style={({ pressed }) => [styles.pill, { backgroundColor: bg }, props.flex && styles.flex, pressed && styles.pressed, props.disabled && styles.disabled, props.style]}
    >
      <Text style={[styles.pillLabel, { color: fg }]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Round − / + buttons around a value, 48dp each. */
export function Stepper(props: { value: ReactNode; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; tone?: "light" | "dark" }) {
  const light_ = props.tone === "light";
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => {
          tapLight();
          props.onMinus();
        }}
        accessibilityRole="button"
        accessibilityLabel={props.minusLabel}
        style={({ pressed }) => [styles.round, { backgroundColor: light_ ? fill.white : colors.ink3 }, pressed && styles.pressed]}
      >
        <Text style={[styles.roundGlyph, { color: light_ ? fill.ink : colors.paper }]}>−</Text>
      </Pressable>
      {props.value}
      <Pressable
        onPress={() => {
          tapLight();
          props.onPlus();
        }}
        accessibilityRole="button"
        accessibilityLabel={props.plusLabel}
        style={({ pressed }) => [styles.round, { backgroundColor: light_ ? fill.white : colors.ink3 }, pressed && styles.pressed]}
      >
        <Text style={[styles.roundGlyph, { color: light_ ? fill.ink : colors.paper }]}>+</Text>
      </Pressable>
    </View>
  );
}

/** Thin progress bar; the number next to it always says the same thing, so colour is never the only signal. */
export function MiniBar(props: { pct: number; track?: string; color: string; label: string; style?: StyleProp<ViewStyle> }) {
  const p = Math.max(0, Math.min(100, Math.round(props.pct)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: 100, now: p }}
      style={[styles.bar, { backgroundColor: props.track ?? colors.line }, props.style]}
    >
      <View style={[styles.barFill, { width: `${p}%`, backgroundColor: props.color }]} />
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

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space(1), paddingHorizontal: space(2), paddingVertical: space(1) },
  headerText: { flex: 1 },
  title: { color: colors.paper, fontSize: type.h1, fontWeight: "600", lineHeight: 32 },
  subtitle: { color: colors.muted, fontSize: type.small },
  close: { width: minTarget, height: minTarget, borderRadius: legacyRadius.pill, backgroundColor: colors.ink3, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: colors.paper, fontSize: 18 },
  pill: { minHeight: minTarget, paddingHorizontal: space(2), borderRadius: legacyRadius.pill, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: type.small, fontWeight: "600" },
  flex: { flex: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2) },
  round: { width: 52, height: 52, borderRadius: legacyRadius.pill, alignItems: "center", justifyContent: "center" },
  roundGlyph: { fontSize: 26, fontWeight: "600", ...tnum },
  bar: { height: 8, borderRadius: legacyRadius.pill, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: legacyRadius.pill },
});
