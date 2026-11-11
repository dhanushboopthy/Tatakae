import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { remaining, type ISODate } from "@tatakae/core";
import { addWater, useFitnessDay } from "../lib/fitness";
import { tapDone } from "../haptics";
import { colors, legacyRadius, minTarget, space, tnum, type } from "../theme";
import { MiniBar, PillButton, fill, hm, n0 } from "./fitnessUi";

/**
 * Fitness card on the Today tab (design canvas "Phone · Today"): kcal left, protein to go, one-tap
 * + Food / + 250 ml / Log set, and the weigh-in line. A rose card with ink text. No streaks, no
 * notification, and over target reads as "over", never as a failure.
 */
export function FitnessCard({ date }: { date: ISODate }) {
  const { data } = useFitnessDay(date);
  if (!data) return null;

  const eaten = data.totals.kcal;
  const target = data.targets?.kcal ?? data.maintenance.kcal;
  const kcal = remaining(eaten, target);
  const proteinTarget = data.targets?.proteinG ?? null;
  const protein = Math.round(data.totals.proteinG);
  const proteinLeft = proteinTarget != null ? Math.max(0, proteinTarget - protein) : null;
  const weight = data.body?.weightKg ?? null;
  const body = data.body;
  const label = data.phase ? `Fitness · ${data.phase.kind === "cut" ? "Cut" : data.phase.kind === "bulk" ? "Bulk" : "Recomp"} wk ${weekOf(data.phaseText)}` : "Fitness";

  return (
    <View style={styles.wrap}>
      <View style={styles.card} accessibilityLabel="Fitness today">
        <View style={styles.top}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[styles.big, tnum]} accessibilityLabel={`${n0(Math.abs(kcal.left))} kcal ${kcal.over ? "over" : "left"} of ${n0(target)}`}>
              {n0(Math.abs(kcal.left))}
            </Text>
            <Text style={styles.statLabel}>{kcal.over ? `kcal over ${n0(target)}` : `kcal left of ${n0(target)}`}</Text>
            <MiniBar pct={kcal.pct} track="rgba(255,255,255,0.6)" color={fill.ink} label="Calories eaten" style={styles.bar} />
          </View>
          <View style={styles.stat}>
            <Text style={[styles.big, tnum]}>
              {proteinLeft != null ? proteinLeft : protein}
              <Text style={styles.unit}> g</Text>
            </Text>
            <Text style={styles.statLabel}>{proteinLeft != null ? "protein to go" : "protein so far"}</Text>
            {proteinTarget != null ? (
              <MiniBar pct={proteinTarget > 0 ? (protein / proteinTarget) * 100 : 0} track="rgba(255,255,255,0.6)" color={fill.ink} label="Protein eaten" style={styles.bar} />
            ) : null}
          </View>
        </View>

        <View style={styles.chips}>
          <PillButton label="+ Food" tone="white" onPress={() => router.push("/fitness/food")} />
          <PillButton
            label="+ 250 ml"
            tone="white"
            onPress={() => {
              void addWater(date, 250);
              tapDone();
            }}
          />
          <PillButton label="Log set" tone="white" onPress={() => router.push("/fitness/set")} />
        </View>

        {weight != null ? (
          <Text style={styles.weighed}>
            ✓ Weighed in · {weight.toFixed(1)} kg{data.trendKg != null ? ` · trend ${data.trendKg.toFixed(1)}` : ""}
          </Text>
        ) : (
          <PillButton label="Weigh in" tone="white" onPress={() => router.push("/fitness/body")} style={styles.weighIn} />
        )}
      </View>

      <Pressable
        onPress={() => router.push("/fitness/body")}
        accessibilityRole="button"
        accessibilityLabel="Body log"
        accessibilityHint="Weight, steps, water and sleep"
        style={({ pressed }) => [styles.bodyRow, pressed && styles.pressed]}
      >
        <View style={styles.bodyText}>
          <Text style={styles.bodyTitle}>Body log</Text>
          <Text style={[styles.bodySub, tnum]}>
            Steps {body?.steps != null ? n0(body.steps) : "—"} · water {body?.waterMl != null ? `${(body.waterMl / 1000).toFixed(2).replace(/\.?0+$/, "") || "0"} L` : "—"} · sleep{" "}
            {body?.sleepMin != null ? hm(body.sleepMin) : "—"}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

/** "Cut · week 7 · −1 % a week" → "7". */
function weekOf(text: string | null): string {
  return /week (\d+)/.exec(text ?? "")?.[1] ?? "1";
}

const styles = StyleSheet.create({
  wrap: { gap: space(1) },
  card: { backgroundColor: fill.rose, borderRadius: 28, padding: space(2.5), gap: space(1.75) },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { backgroundColor: "#E57FB8", borderRadius: legacyRadius.pill, paddingHorizontal: space(1.5), paddingVertical: 6 },
  chipText: { color: fill.ink, fontSize: 13, fontWeight: "600" },
  stats: { flexDirection: "row", gap: space(2) },
  stat: { flex: 1 },
  big: { color: fill.ink, fontSize: 40, lineHeight: 44, fontWeight: "600", letterSpacing: -0.5 },
  unit: { fontSize: 20 },
  statLabel: { color: fill.ink, fontSize: type.small, fontWeight: "500", marginTop: 4 },
  bar: { marginTop: space(1.25) },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
  weighed: { color: fill.ink, fontSize: 13, fontWeight: "500" },
  weighIn: { alignSelf: "flex-start" },
  bodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    minHeight: minTarget + 12,
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    backgroundColor: colors.ink2,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: legacyRadius.card,
  },
  bodyText: { flex: 1 },
  bodyTitle: { color: colors.paper, fontSize: type.body, fontWeight: "600" },
  bodySub: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.paper, fontSize: 24 },
  pressed: { opacity: 0.85 },
});
