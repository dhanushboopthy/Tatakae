import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { logBody, useFitnessDay } from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { MiniBar, PillButton, SheetHeader, Stepper, fill, hm, parseNum } from "../../src/components/fitnessUi";
import { tapDone } from "../../src/haptics";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../../src/lib/theme";

const tnum = { fontVariant: ["tabular-nums" as const] };

// Log body (design canvas "Phone · Log body"): morning weight with − / + 0.1, steps, water +250 / +500, sleep ± 15 min.
// Prefilled with the last weight, so the usual weigh-in is: open, tap Save. Writes go to the outbox (works offline).

const WATER_STEP = [250, 500] as const;

export default function LogBody() {
  const styles = useStyles(makeStyles);
  const { c } = useTheme();
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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.headerPad}>
          <SheetHeader title="Log body" onClose={() => router.back()} />
        </View>
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
              placeholderTextColor={c.ink2}
              style={[styles.stepsInput, tnum]}
            />
          </View>

          {/* Water */}
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>Water</Text>
              <Text style={[styles.body, tnum]}>
                <Text style={styles.bold}>{(water / 1000).toFixed(2).replace(/\.?0+$/, "") || "0"}</Text> / {waterTarget / 1000} L
              </Text>
            </View>
            <MiniBar pct={waterTarget > 0 ? (water / waterTarget) * 100 : 0} color={c.lavenderDeep} label="Water" />
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
              <Text style={styles.small}>target {hm(sleepTarget)}</Text>
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
            <Text accessibilityRole="alert" style={styles.body}>
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

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.surface },
    fill: { flex: 1 },
    headerPad: { paddingHorizontal: space(2.5), paddingTop: space(1) },
    content: { paddingHorizontal: space(2.5), paddingTop: space(1), paddingBottom: space(3), gap: space(2.5) },
    body: { ...f(400, 16, 24), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    weightCard: { backgroundColor: fill.limeSoft, borderRadius: radius.card, padding: space(2.25), alignItems: "center", gap: space(1) },
    weightLabel: { ...f(600, 13, 18), color: fill.inkMuted },
    weightValue: { flexDirection: "row", alignItems: "baseline", gap: 4, minWidth: 130, justifyContent: "center" },
    weightInput: { ...f(600, 52, 60), color: fill.ink, minWidth: 100, textAlign: "center", paddingVertical: 0 },
    weightUnit: { ...f(500, 18), color: fill.inkMuted },
    weightHint: { ...f(500, 13, 18), color: fill.inkMuted },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
    rowLabel: { ...f(600, 15), color: c.ink },
    stepsInput: {
      width: 140,
      minHeight: minTarget + 8,
      textAlign: "right",
      borderRadius: radius.pill,
      backgroundColor: c.surface2,
      paddingHorizontal: space(2),
      color: c.ink,
      ...f(600, 16),
    },
    block: { gap: space(1.25), borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(1.75) },
    bold: { ...f(700, 16) },
    buttons: { flexDirection: "row", gap: space(1) },
    sleepValue: { ...f(600, 17), color: c.ink, minWidth: 84, textAlign: "center" },
    footer: { paddingHorizontal: space(2.5), paddingBottom: space(2), paddingTop: space(1) },
    save: { minHeight: 56, borderRadius: radius.pill, backgroundColor: c.hero, alignItems: "center", justifyContent: "center", minWidth: minTarget },
    saveText: { ...f(600, 16), color: c.onHero },
    pressed: pressedStyle,
  });
