import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MAX_ACTIVE_GOALS, type GoalStatus } from "@tatakae/core";
import { useAreas } from "../src/lib/hooks";
import { removeGoal, saveGoal, useGoals } from "../src/lib/planning";
import { BigButton } from "../src/components/BigButton";
import { SegmentedPills } from "../src/components/SegmentedPills";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useStyles, type Theme } from "../src/lib/theme";

// Add or edit a Cycle goal (website: Cycle → Goals). Up to four can be active, and each active goal has to pass the
// "hell yeah" gate: not a should, something you'd be gutted not to do.

const STATUS: readonly { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "dropped", label: "Dropped" },
];

export default function GoalEditor() {
  const s = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: goals = [] } = useGoals();
  const { data: areas = [] } = useAreas();
  const goal = id ? (goals.find((g) => g.id === id) ?? null) : null;
  const seeded = useRef(false);
  const [f2, setF] = useState({ name: "", intent: "", outcome: "", niceGoal: "", nextAction: "", why: "", targetPoints: "" });
  const [areaId, setAreaId] = useState<string | null>(null);
  const [hellYeah, setHellYeah] = useState(false);
  const [status, setStatus] = useState<GoalStatus>("active");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seeded.current || (id && goals.length === 0)) return;
    seeded.current = true;
    if (!goal) return;
    setF({
      name: goal.name,
      intent: goal.intent ?? "",
      outcome: goal.outcome ?? "",
      niceGoal: goal.niceGoal ?? "",
      nextAction: goal.nextAction ?? "",
      why: goal.why ?? "",
      targetPoints: goal.targetPoints != null ? String(goal.targetPoints) : "",
    });
    setAreaId(goal.areaId);
    setHellYeah(goal.hellYeah);
    setStatus(goal.status);
  }, [goal, goals.length, id]);

  const activeCount = goals.filter((g) => g.status === "active").length;
  const wasActive = goal?.status === "active";
  const full = !wasActive && activeCount >= MAX_ACTIVE_GOALS;
  const problem =
    status === "active" && !hellYeah
      ? "An active goal has to be a hell yeah. Pause it, or tick the box if it really is."
      : status === "active" && full
        ? "Four goals are already active. Pause or finish one first."
        : null;
  const set = (k: keyof typeof f2) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f2.name.trim() || problem || busy) return;
    setBusy(true);
    try {
      const n = (v: string) => v.trim() || null;
      const tp = Number.parseInt(f2.targetPoints, 10);
      await saveGoal({
        id: goal?.id,
        name: f2.name.trim(),
        areaId,
        status,
        intent: n(f2.intent),
        outcome: n(f2.outcome),
        niceGoal: n(f2.niceGoal),
        nextAction: n(f2.nextAction),
        why: n(f2.why),
        hellYeah,
        targetPoints: Number.isFinite(tp) && tp > 0 ? tp : null,
        start: goal?.start ?? null,
        end: goal?.end ?? null,
      });
      tapDone();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      sheet
      footer={<BigButton label="Save goal" variant="accent" size="large" busy={busy} disabled={!f2.name.trim() || problem !== null} onPress={() => void save()} />}
    >
      <SheetHeader title={goal ? "Edit goal" : "Add goal"} subtitle={`${activeCount} of ${MAX_ACTIVE_GOALS} active`} onClose={() => router.back()} />
      <Card tone="surface">
        <TextField label="Goal" value={f2.name} onChangeText={set("name")} maxLength={200} />
        <View style={s.group}>
          <Text style={s.label}>Area</Text>
          <View style={s.chips}>
            <Pick label="None" on={areaId === null} onPress={() => setAreaId(null)} />
            {areas.map((a) => (
              <Pick key={a.id} label={a.name} on={areaId === a.id} onPress={() => setAreaId(a.id)} />
            ))}
          </View>
        </View>
        <TextField label="Intent" value={f2.intent} onChangeText={set("intent")} maxLength={500} placeholder="What you're going for" />
        <TextField label="Outcome" value={f2.outcome} onChangeText={set("outcome")} maxLength={500} placeholder="How you'll know it happened" />
        <TextField label="Nice-to-have" value={f2.niceGoal} onChangeText={set("niceGoal")} maxLength={500} placeholder="The stretch version" />
        <TextField label="Why" value={f2.why} onChangeText={set("why")} maxLength={500} />
        <TextField label="Next physical action" value={f2.nextAction} onChangeText={set("nextAction")} maxLength={300} />
        <TextField label="Target points (ring)" value={f2.targetPoints} onChangeText={(v) => set("targetPoints")(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={5} />
        <Pressable
          onPress={() => {
            tapLight();
            setHellYeah((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hellYeah }}
          style={({ pressed }) => [s.hell, pressed && pressedStyle]}
        >
          <Text style={s.box}>{hellYeah ? "✓" : ""}</Text>
          <View style={s.flex}>
            <Text style={s.label}>Hell yeah.</Text>
            <Text style={s.small}>Not a should — you'd be gutted not to do it.</Text>
          </View>
        </Pressable>
        <SegmentedPills accessibilityLabel="Status" value={status} onChange={setStatus} options={STATUS} />
        {problem ? (
          <Text accessibilityRole="alert" style={s.body}>
            {problem}
          </Text>
        ) : null}
      </Card>
      {goal ? (
        <BigButton
          label="Delete goal"
          variant="quiet"
          size="compact"
          onPress={async () => {
            await removeGoal(goal.id);
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

function Pick({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && pressedStyle]}
    >
      <Text style={s.chipText}>
        {on ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 14, 20), color: c.ink },
    group: { gap: space(0.75) },
    flex: { flex: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2 },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
    hell: { flexDirection: "row", alignItems: "center", gap: space(1.5), minHeight: 56, padding: space(1.5), borderRadius: radius.inner, backgroundColor: c.surface2 },
    box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: c.ink, textAlign: "center", ...f(700, 16, 24), color: c.ink },
  });
