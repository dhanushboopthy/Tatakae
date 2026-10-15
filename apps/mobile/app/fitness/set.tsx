import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MUSCLE_GROUPS, kgText, lastSets, lastTimeText, type WorkoutSet } from "@tatakae/core";
import { finishWorkout, logSet, startWorkout, useTraining } from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { PillButton, SheetHeader, Stepper, fill, parseNum } from "../../src/components/fitnessUi";
import { tapDone, tapTimerEnd } from "../../src/haptics";
import { colors, legacyRadius, space, text, tnum, type, ui } from "../../src/theme";

// Log set (design canvas "Phone · Log set"): during a workout. Exercise (the last one used), kg and reps with
// − / + steppers, "Same again" in one tap, a rest timer that is only on this screen (no notification) and what is
// up next from your last session of the same name. Writes go to the outbox.

const SESSION_NAMES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body"] as const;
const REST_SECONDS = 90;

export default function LogSet() {
  const today = useToday();
  const { data } = useTraining(today);
  const workout = data?.workouts.find((w) => w.date === today) ?? null;
  const sets = useMemo(() => (data && workout ? data.sets.filter((s) => s.workoutId === workout.id) : []), [data, workout]);

  const [exercise, setExercise] = useState("");
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0]);
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [rest, setRest] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const seeded = useRef(false);

  // What "up next" means: exercises of the last session with the same name that are not done yet today.
  const previous = useMemo(() => (data && workout ? data.workouts.find((w) => w.date < today && w.name === workout.name) ?? null : null), [data, workout, today]);
  const upNext = useMemo(() => {
    if (!data || !previous) return [] as { name: string; count: number; reps: number; kg: number; muscle: string }[];
    const done = new Set(sets.map((s) => s.exercise));
    const out: { name: string; count: number; reps: number; kg: number; muscle: string }[] = [];
    for (const s of data.sets.filter((x) => x.workoutId === previous.id)) {
      if (done.has(s.exercise)) continue;
      const row = out.find((o) => o.name === s.exercise);
      if (row) row.count += 1;
      else out.push({ name: s.exercise, count: 1, reps: s.reps, kg: s.kg, muscle: s.muscle });
    }
    return out;
  }, [data, previous, sets]);

  /** Pick an exercise: fill the muscle, kg and reps from today's last set, else from last time. */
  function choose(name: string, muscleHint?: string) {
    if (!data) return;
    setExercise(name);
    setAdding(false);
    setProblem(null);
    const todays = sets.filter((s) => s.exercise === name);
    const ref: Pick<WorkoutSet, "kg" | "reps" | "muscle"> | undefined = todays[todays.length - 1] ?? lastSets(name, data.workouts, data.sets, today)[0];
    setMuscle(muscleHint ?? ref?.muscle ?? data.exercises.find((e) => e.name === name)?.muscle ?? MUSCLE_GROUPS[0]);
    setKg(ref ? kgText(ref.kg) : "");
    setReps(ref ? String(ref.reps) : "");
  }

  // Start on the last exercise used today, else the first one up next, else the most used one.
  useEffect(() => {
    if (!data || !workout || seeded.current) return;
    seeded.current = true;
    const last = sets[sets.length - 1];
    const first = last?.exercise ?? upNext[0]?.name ?? data.exercises[0]?.name ?? "";
    if (first) choose(first);
  }, [data, workout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rest timer: only while this screen is open; a quiet haptic at zero, never a notification.
  useEffect(() => {
    if (rest == null) return;
    if (rest <= 0) {
      tapTimerEnd();
      setRest(null);
      return;
    }
    const id = setTimeout(() => setRest((r) => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  if (!data) return <SafeAreaView style={ui.screen} edges={["top"]} />;

  if (!workout) {
    return (
      <SafeAreaView style={ui.screen} edges={["top", "bottom"]}>
        <SheetHeader title="Log set" onClose={() => router.back()} />
        <View style={styles.content}>
          <Text style={text.h2}>Start a session</Text>
          <Text style={text.small}>Name it, then log each set in a tap or two.</Text>
          <View style={styles.wrap}>
            {SESSION_NAMES.map((n) => (
              <PillButton key={n} label={n} tone="neutral" onPress={() => void startWorkout(today, n)} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const done = sets.filter((s) => s.exercise === exercise);
  const nextOrder = sets.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  const lastDone = done[done.length - 1];
  const before = exercise ? lastSets(exercise, data.workouts, data.sets, today) : [];
  const sameRef = lastDone ?? before[0];
  const kgNow = parseNum(kg);
  const repsNow = parseNum(reps);

  const names = [...new Set([...sets.map((s) => s.exercise), ...upNext.map((u) => u.name), ...data.exercises.slice(0, 8).map((e) => e.name)])];

  async function record(k: number, r: number) {
    await logSet({ workoutId: workout!.id, exercise, muscle, reps: r, kg: k, order: nextOrder });
    tapDone();
    setRest(REST_SECONDS);
  }

  async function save() {
    if (!exercise) return setProblem("Pick an exercise first.");
    if (kgNow == null || kgNow > 1000) return setProblem("Weight should be a number of kg (0 for bodyweight).");
    if (repsNow == null || repsNow < 1 || repsNow > 200 || !Number.isInteger(repsNow)) return setProblem("Reps should be a whole number from 1 to 200.");
    setProblem(null);
    await record(kgNow, repsNow);
  }

  async function sameAgain() {
    if (!sameRef || !exercise) return;
    setKg(kgText(sameRef.kg));
    setReps(String(sameRef.reps));
    await record(sameRef.kg, sameRef.reps);
  }

  async function finish() {
    const first = sets[0];
    const minutes = first ? Math.max(1, Math.round((Date.now() - Date.parse(first.updatedAt)) / 60000)) : null;
    if (minutes != null) await finishWorkout(workout!, minutes);
    router.back();
  }

  return (
    <SafeAreaView style={ui.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SheetHeader
          title={workout.name}
          subtitle={`${sets.length} ${sets.length === 1 ? "set" : "sets"}`}
          onClose={() => router.back()}
          right={<PillButton label="Finish" tone="neutral" onPress={() => void finish()} />}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* exercise chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Exercises">
            {names.map((n) => (
              <PillButton key={n} label={n} tone={n === exercise ? "lime" : "neutral"} onPress={() => choose(n)} />
            ))}
            <PillButton label="+ New" tone="neutral" onPress={() => setAdding(true)} />
          </ScrollView>

          {adding ? (
            <View style={ui.card}>
              <Text style={text.label}>New exercise</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Exercise name"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Exercise name"
                style={ui.input}
                autoFocus
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Muscle">
                {MUSCLE_GROUPS.map((m) => (
                  <PillButton key={m} label={m} tone={m === muscle ? "lime" : "neutral"} onPress={() => setMuscle(m)} />
                ))}
              </ScrollView>
              <PillButton
                label="Use this exercise"
                tone="primary"
                onPress={() => {
                  const n = newName.trim();
                  if (!n) return setProblem("Give the exercise a name.");
                  choose(n, muscle);
                  setNewName("");
                }}
              />
            </View>
          ) : null}

          {/* current exercise */}
          {exercise ? (
            <View style={styles.current}>
              <View style={styles.currentTop}>
                <View style={styles.currentText}>
                  <Text style={styles.exName}>{exercise}</Text>
                  <Text style={[styles.exSub, tnum]}>
                    {muscle}
                    {before.length > 0 ? ` · last time ${lastTimeText(before)}` : ""}
                  </Text>
                </View>
                <View style={styles.setBadge}>
                  <Text style={styles.setBadgeText}>Set {done.length + 1}</Text>
                </View>
              </View>

              <View style={styles.inputs}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>kg</Text>
                  <Stepper
                    tone="light"
                    minusLabel="Less weight"
                    plusLabel="More weight"
                    onMinus={() => setKg(kgText(Math.max(0, (kgNow ?? 0) - 2.5)))}
                    onPlus={() => setKg(kgText((kgNow ?? 0) + 2.5))}
                    value={<NumberBox value={kg} onChange={setKg} label="Weight in kilograms" decimal />}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>reps</Text>
                  <Stepper
                    tone="light"
                    minusLabel="Fewer reps"
                    plusLabel="More reps"
                    onMinus={() => setReps(String(Math.max(1, (repsNow ?? 1) - 1)))}
                    onPlus={() => setReps(String((repsNow ?? 0) + 1))}
                    value={<NumberBox value={reps} onChange={setReps} label="Repetitions" />}
                  />
                </View>
              </View>

              <View style={styles.actions}>
                <PillButton label="Same again" tone="white" flex disabled={!sameRef} onPress={() => void sameAgain()} />
                <PillButton label="Save set" tone="primary" flex onPress={() => void save()} />
              </View>
              {problem ? (
                <Text accessibilityRole="alert" style={styles.problem}>
                  {problem}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={text.small}>Pick an exercise above, or add a new one.</Text>
          )}

          {/* done sets */}
          {done.length > 0 ? (
            <View style={styles.doneList}>
              {done.map((s, i) => (
                <View key={s.id} style={styles.doneRow}>
                  <Text style={styles.doneSet}>Set {i + 1}</Text>
                  <Text style={[styles.doneValue, tnum]}>
                    {kgText(s.kg)} kg × {s.reps}
                  </Text>
                  <Text accessibilityLabel="done" style={styles.doneTick}>
                    ✓
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* rest */}
          {rest != null ? (
            <View style={styles.rest}>
              <View>
                <Text style={styles.restLabel}>Rest</Text>
                <Text style={[styles.restTime, tnum]} accessibilityLabel={`Rest ${Math.floor(rest / 60)} minutes ${rest % 60} seconds`}>
                  {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
                </Text>
              </View>
              <View style={styles.restButtons}>
                <PillButton label="+30 s" tone="white" onPress={() => setRest((r) => (r ?? 0) + 30)} />
                <PillButton label="Skip" tone="white" onPress={() => setRest(null)} />
              </View>
            </View>
          ) : null}

          {/* up next */}
          {upNext.length > 0 ? (
            <View style={styles.next}>
              <Text style={text.label}>Up next</Text>
              {upNext.map((u) => (
                <View key={u.name} style={styles.nextRow}>
                  <Text style={styles.nextName} onPress={() => choose(u.name, u.muscle)} accessibilityRole="button" accessibilityLabel={`Switch to ${u.name}`}>
                    {u.name}
                  </Text>
                  <Text style={[text.small, tnum]}>
                    {u.count} × {u.reps} · {kgText(u.kg)} kg
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NumberBox({ value, onChange, label, decimal }: { value: string; onChange: (v: string) => void; label: string; decimal?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      accessibilityLabel={label}
      placeholder="0"
      placeholderTextColor={fill.inkMuted}
      selectTextOnFocus
      style={[styles.number, tnum]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space(2), paddingBottom: space(3), gap: space(1.75) },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
  chips: { gap: space(1), paddingVertical: 2 },
  current: { backgroundColor: fill.limeSoft, borderRadius: 24, padding: space(2.25), gap: space(1.75) },
  currentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space(1) },
  currentText: { flex: 1 },
  exName: { color: fill.ink, fontSize: 20, fontWeight: "600" },
  exSub: { color: fill.inkMuted, fontSize: 13, marginTop: 2 },
  setBadge: { backgroundColor: fill.lime, borderRadius: legacyRadius.pill, paddingHorizontal: space(1.5), paddingVertical: 6 },
  setBadgeText: { color: fill.ink, fontSize: 13, fontWeight: "600" },
  inputs: { gap: space(1.5) },
  inputCol: { gap: 6, alignItems: "center" },
  inputLabel: { color: fill.inkMuted, fontSize: 13, fontWeight: "600" },
  number: { color: fill.ink, fontSize: 40, fontWeight: "600", minWidth: 96, textAlign: "center", paddingVertical: 0 },
  actions: { flexDirection: "row", gap: space(1) },
  problem: { color: fill.ink, fontSize: type.small, fontWeight: "600" },
  doneList: { gap: space(0.5) },
  doneRow: { flexDirection: "row", alignItems: "center", gap: space(1.5), minHeight: 44 },
  doneSet: { color: colors.muted, fontSize: type.small, width: 56 },
  doneValue: { color: colors.paper, fontSize: type.body, fontWeight: "600", flex: 1 },
  doneTick: { color: colors.paper, fontSize: 18, fontWeight: "700" },
  rest: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: fill.lavenderSoft, borderRadius: legacyRadius.card, padding: space(2), gap: space(1) },
  restLabel: { color: fill.inkMuted, fontSize: 13, fontWeight: "600" },
  restTime: { color: fill.ink, fontSize: 30, fontWeight: "600" },
  restButtons: { flexDirection: "row", gap: space(1) },
  next: { gap: space(0.5) },
  nextRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, gap: space(1) },
  nextName: { color: colors.paper, fontSize: type.body, fontWeight: "600", paddingVertical: 10, flexShrink: 1 },
});
