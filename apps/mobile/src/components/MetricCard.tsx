import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { MetricBox } from "@tatakae/core";
import { f, radius, space } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";
import { IconCircle } from "./IconCircle";

/**
 * Scoreboard box (docs/10 §5, docs/11 §2): label (+ ↗ when it opens something), big number with a
 * small delta pill (lime ↗ better, grey ↘ worse — never red), one context line, thin progress bar
 * with % at the right. `tone="surface2"` sits on a white screen; `"surface"` on the canvas.
 */
export function MetricCard(props: {
  box: MetricBox;
  tone?: "surface" | "surface2";
  bar?: "lime" | "lavender";
  onOpen?: () => void;
  /** Replace the formatted number and add a small unit after it. */
  valueText?: string;
  unitText?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles(makeStyles);
  const { box } = props;
  const value = props.valueText ?? (box.value == null ? "—" : box.unit === "%" ? `${box.value}%` : String(box.value));
  const unit = props.unitText ?? (box.unit === "min" && box.value != null ? "min" : null);
  const spoken = `${box.label}: ${box.value == null ? "not yet" : `${value}${unit ? ` ${unit}` : ""}`}. ${box.context}`;
  return (
    <View style={[s.card, props.tone === "surface" && s.onCanvas, props.style]}>
      <View style={s.head}>
        <Text style={s.label} numberOfLines={1}>
          {box.label}
        </Text>
        {props.onOpen ? (
          <IconCircle icon="open" size={36} variant={props.tone === "surface" ? "neutral" : "white"} onPress={props.onOpen} accessibilityLabel={`Open ${box.label}`} />
        ) : null}
      </View>
      <View style={s.valueRow} accessible accessibilityLabel={spoken}>
        <Text style={s.value}>{value}</Text>
        {unit ? <Text style={s.unit}>{unit}</Text> : null}
        <DeltaPill delta={box.delta} unit={box.unit} />
      </View>
      <Text style={s.context} numberOfLines={2}>
        {box.context}
      </Text>
      {props.children}
      {box.progress != null ? <ProgressBar pct={box.progress} tone={props.bar ?? "lime"} label={box.label} /> : null}
    </View>
  );
}

export function DeltaPill({ delta, unit }: { delta: number | null; unit?: MetricBox["unit"] }) {
  const s = useStyles(makeStyles);
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const suffix = unit === "%" ? "%" : unit === "min" ? " min" : "";
  return (
    <View style={[s.delta, up ? s.deltaUp : s.deltaDown]} accessibilityLabel={`${up ? "up" : "down"} ${Math.abs(delta)}${suffix}`}>
      <Text style={[s.deltaText, up ? s.deltaTextUp : s.deltaTextDown]}>
        {up ? "↗ +" : "↘ −"}
        {Math.abs(delta)}
        {suffix}
      </Text>
    </View>
  );
}

/** Thin bar with the % beside it, so the colour is never the only signal. */
export function ProgressBar({ pct, tone = "lime", label }: { pct: number; tone?: "lime" | "lavender"; label: string }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <View style={s.barRow}>
      <View
        style={s.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} progress`}
        accessibilityValue={{ min: 0, max: 100, now: p }}
      >
        <View style={[s.fill, { width: `${p}%`, backgroundColor: tone === "lime" ? c.limeDeep : c.lavenderDeep }]} />
      </View>
      <Text style={s.pct} accessibilityElementsHidden importantForAccessibility="no">
        {p}%
      </Text>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    card: { flex: 1, backgroundColor: c.surface2, borderRadius: 22, padding: space(2), gap: space(0.75) },
    onCanvas: { backgroundColor: c.surface },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1), minHeight: 36 },
    label: { ...f(600, 13, 18), color: c.ink, flexShrink: 1 },
    valueRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: space(0.75) },
    value: { ...f(600, 34, 40), color: c.ink, letterSpacing: -0.7, fontVariant: ["tabular-nums"] },
    unit: { ...f(500, 14, 20), color: c.ink2 },
    context: { ...f(500, 13, 18), color: c.ink2 },
    delta: { borderRadius: radius.pill, paddingHorizontal: space(1), paddingVertical: 2, alignSelf: "center" },
    deltaUp: { backgroundColor: c.lime },
    deltaDown: { backgroundColor: c.surface },
    deltaText: { ...f(600, 12, 16), fontVariant: ["tabular-nums"] },
    deltaTextUp: { color: c.onFill },
    deltaTextDown: { color: c.ink2 },
    barRow: { flexDirection: "row", alignItems: "center", gap: space(1.5), paddingTop: space(0.5) },
    track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: c.line, overflow: "hidden" },
    fill: { height: "100%", borderRadius: radius.pill },
    pct: { ...f(600, 14), color: c.ink, minWidth: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  });
