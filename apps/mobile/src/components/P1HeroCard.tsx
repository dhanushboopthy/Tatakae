import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Mission } from "@tatakae/core";
import { f, radius, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
import { tapLight } from "../haptics";
import { Icon } from "./Icon";

/**
 * P1 hero (docs/10 §5, ref 02): charcoal card (inverted light card at night), P1 pill, est. minutes
 * outline pill, status at the right, title with the lime 56 Start arrow, Minimum and if-then lines.
 * `children` sits under the text (status chips on Today, length pills on Morning).
 */
export function P1HeroCard(props: {
  mission: Mission;
  /** Start a focus block. Hidden when the mission is no longer open. */
  onStart?: () => void;
  startLabel?: string;
  /** Right side of the pill row, e.g. "Done ✓" or "locked". */
  status?: string;
  tall?: boolean;
  children?: ReactNode;
}) {
  const s = useStyles(makeStyles);
  const m = props.mission;
  const open = m.status === "open";
  const onStart = props.onStart;
  return (
    <View style={[s.card, props.tall && s.tall]}>
      <View style={s.pills}>
        <View style={s.rank}>
          <Text style={s.rankText}>P1</Text>
        </View>
        {m.estMin ? (
          <View style={s.est}>
            <Text style={s.estText}>{m.estMin} min</Text>
          </View>
        ) : null}
        {props.status ? <Text style={s.status}>{props.status}</Text> : null}
      </View>
      <View style={s.titleRow}>
        <Text style={[s.title, props.tall && s.titleTall]} accessibilityRole="header">
          {m.title}
        </Text>
        {open && onStart ? (
          <Pressable
            onPress={() => {
              tapLight();
              onStart();
            }}
            accessibilityRole="button"
            accessibilityLabel={props.startLabel ?? "Start focus on P1"}
            style={({ pressed }) => [s.start, props.tall && s.startTall, pressed && pressedStyle]}
          >
            <Icon name="start" color={s.startIcon.color} size={props.tall ? 30 : 26} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      {m.minimum ? <Text style={s.line}>Minimum · {m.minimum}</Text> : null}
      {m.ifThen ? <Text style={s.line}>If-then · {m.ifThen}</Text> : null}
      {m.resumeNote ? <Text style={s.line}>Resume · {m.resumeNote}</Text> : null}
      {props.children}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: c.hero, borderRadius: radius.card, padding: space(2.5), gap: space(1.25) },
    tall: { paddingVertical: space(3.5), gap: space(1.5) },
    pills: { flexDirection: "row", alignItems: "center", gap: space(1) },
    rank: { backgroundColor: c.lime, borderRadius: radius.pill, paddingHorizontal: space(1.25), paddingVertical: 5 },
    rankText: { ...f(700, 12, 16), color: c.onFill },
    est: { borderWidth: 1, borderColor: c.heroLine, borderRadius: radius.pill, paddingHorizontal: space(1.25), paddingVertical: 4 },
    estText: { ...f(500, 12, 16), color: c.onHeroMuted, fontVariant: ["tabular-nums"] },
    status: { ...f(600, 12, 16), color: c.onHeroMuted, marginLeft: "auto" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
    title: { ...f(600, 21, 26), color: c.onHero, flex: 1 },
    titleTall: { ...f(600, 26, 32) },
    start: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.lime, alignItems: "center", justifyContent: "center" },
    startTall: { width: 64, height: 64, borderRadius: 32 },
    startIcon: { color: c.onFill },
    line: { ...f(500, 13, 18), color: c.onHeroMuted },
  });
