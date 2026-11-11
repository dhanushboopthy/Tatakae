import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { logBody, useFitnessDay } from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { MiniBar, PillButton, SheetHeader, Stepper, fill, hm, parseNum } from "../../src/components/fitnessUi";
import { tapDone } from "../../src/haptics";
import { colors, legacyRadius, minTarget, space, text, tnum, ui } from "../../src/theme";

// Log body (design canvas "Phone · Log body"): morning weight with − / + 0.1, steps, water +250 / +500, sleep ± 15 min.
// Prefilled with the last weight, so the usual weigh-in is: open, tap Save. Writes go to the outbox (works offline).

const WATER_STEP = [250, 500] as const;

export default function LogBody() {
  const today = useToday();
  const { data } = useFitnessDay(today);
  const seeded = useRef(false);
  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [water, setWater] = useState(0);
  const [sleep, setSleep] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  // Fill the form once, from today's log, else the last weight.
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    const w = data.body?.weightKg ?? data.previousWeightKg;
    setWeight(w != null ? w.toFixed(1) : "");
    setSteps(data.body?.steps != null ? String(data.body.steps) : "");
    setWater(data.body?.waterMl ?? 0);
    setSleep(data.body?.sleepMin ?? 0);
  }, [data]);

  const waterTarget = data?.settings["fitness.waterTargetMl"] ?? 3000;
  const sleepTarget = data?.settings["fitness.sleepTargetMin"] ?? 450;
  const weightNow = parseNum(weight);

  function nudgeWeight(delta: number) {
    const base = weightNow ?? data?.previousWeightKg ?? 70;
    setWeight((Math.round((base + delta) * 10) / 10).toFixed(1));
  }

  async function save() {
    const w = weight.trim() === "" ? null : weightNow;
    const st = steps.trim() === "" ? null : parseNum(steps);
    if (weight.trim() !== "" && (w == null || w < 20 || w > 400)) return setProblem("Weight should be between 20 and 400 kg.");
    if (steps.trim() !== "" && st == null) return setProblem("Steps should be a number.");
    setProblem(null);
    await logBody(today, {
      weightKg: w,
      steps: st == null ? null : Math.round(st),
      waterMl: water > 0 ? water : null,
      sleepMin: sleep > 0 ? sleep : null,
    });
    tapDone();
    router.back();
  }

  return (
    <SafeAreaView style={ui.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SheetHeader title="Log body" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Weight */}
          <View style={styles.weightCard}>
            <Text style={styles.weightLabel}>Morning weight</Text>
            <Stepper
              tone="light"
              minusLabel="Minus 0.1 kg"
              plusLabel="Plus 0.1 kg"
              onMinus={() => nudgeWeight(-0.1)}
              onPlus={() => nudgeWeight(0.1)}
              value={
                <View style={styles.weightValue}>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Weight in kilograms"
                    placeholder="0.0"
                    placeholderTextColor={fill.inkMuted}
                    style={[styles.weightInput, tnum]}
                  />
                  <Text style={styles.weightUnit}>kg</Text>
                </View>
              }
            />
            <Text style={styles.weightHint}>
              {data?.previousWeightKg != null ? `Last ${data.previousWeightKg.toFixed(1)}` : "First weigh-in"}
              {data?.trendKg != null ? ` · trend ${data.trendKg.toFixed(1)}` : ""}
            </Text>
          </View>

          {/* Steps */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Steps</Text>
            <TextInput
              value={steps}
              onChangeText={setSteps}
              keyboardType="number-pad"
              accessibilityLabel="Steps"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={[ui.input, styles.stepsInput, tnum]}
            />
          </View>

          {/* Water */}
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>Water</Text>
              <Text style={[text.body, tnum]}>
                <Text style={styles.bold}>{(water / 1000).toFixed(2).replace(/\.?0+$/, "") || "0"}</Text> / {waterTarget / 1000} L
              </Text>
            </View>
            <MiniBar pct={waterTarget > 0 ? (water / waterTarget) * 100 : 0} color={colors.paper} label="Water" />
            <View style={styles.buttons}>
              {WATER_STEP.map((ml) => (
                <PillButton key={ml} label={`+ ${ml} ml`} tone="lavender" flex onPress={() => setWater((w) => w + ml)} />
              ))}
              <PillButton label="Reset" tone="neutral" disabled={water === 0} onPress={() => setWater(0)} accessibilityLabel="Reset water to zero" />
            </View>
          </View>

          {/* Sleep */}
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.rowLabel}>Sleep</Text>
              <Text style={text.small}>target {hm(sleepTarget)}</Text>
            </View>
            <Stepper
              minusLabel="Minus 15 minutes"
              plusLabel="Plus 15 minutes"
              onMinus={() => setSleep((s) => Math.max(0, s - 15))}
              onPlus={() => setSleep((s) => Math.min(1440, s + 15))}
              value={<Text style={[styles.sleepValue, tnum]}>{sleep > 0 ? hm(sleep) : "—"}</Text>}
            />
          </View>

          {problem ? (
            <Text accessibilityRole="alert" style={text.body}>
              {problem}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => void save()}
            accessibilityRole="button"
            accessibilityLabel="Save"
            style={({ pressed }) => [styles.save, pressed && styles.pressed]}
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space(2), paddingBottom: space(3), gap: space(2.5) },
  weightCard: { backgroundColor: fill.limeSoft, borderRadius: 24, padding: space(2.25), alignItems: "center", gap: space(1) },
  weightLabel: { color: fill.inkMuted, fontSize: 13, fontWeight: "600" },
  weightValue: { flexDirection: "row", alignItems: "baseline", gap: 4, minWidth: 130, justifyContent: "center" },
  weightInput: { color: fill.ink, fontSize: 52, lineHeight: 60, fontWeight: "600", minWidth: 100, textAlign: "center", paddingVertical: 0 },
  weightUnit: { color: fill.inkMuted, fontSize: 18, fontWeight: "500" },
  weightHint: { color: fill.inkMuted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
  rowLabel: { color: colors.paper, fontSize: 15, fontWeight: "600" },
  stepsInput: { width: 140, textAlign: "right", borderRadius: legacyRadius.pill, fontWeight: "600" },
  block: { gap: space(1.25), borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(1.75) },
  bold: { fontWeight: "700" },
  buttons: { flexDirection: "row", gap: space(1) },
  sleepValue: { color: colors.paper, fontSize: 17, fontWeight: "600", minWidth: 84, textAlign: "center" },
  footer: { paddingHorizontal: space(2), paddingBottom: space(2), paddingTop: space(1) },
  save: { minHeight: 56, borderRadius: legacyRadius.pill, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center", minWidth: minTarget },
  saveText: { color: fill.ink, fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.85 },
});
