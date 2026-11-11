import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { KCAL_TARGET_MAX, KCAL_TARGET_MIN, type ISODate } from "@tatakae/core";
import { changePhaseStart, setKcalOverride, setManualKcal, useFitnessDay, type PhaseStartProblem } from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { longDate } from "../../src/lib/format";
import { BigButton } from "../../src/components/BigButton";
import { DateStepper } from "../../src/components/DateStepper";
import { Stepper, fill, n0 } from "../../src/components/fitnessUi";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { tapDone } from "../../src/haptics";
import { f, radius, space } from "../../src/theme";
import { useStyles, useTheme, type Theme } from "../../src/lib/theme";

const STEP = 50;

const PHASE_PROBLEM: Record<PhaseStartProblem, string> = {
  future: "The start date can't be in the future.",
  before_previous: "That is on or before the start of the phase before this one.",
  after_end: "The start date can't be after this phase's end.",
  missing: "That phase is no longer there.",
};

const SOURCE_TEXT = {
  auto: "Calculated from your phase and maintenance.",
  manual: "A standing target you typed in.",
  day: "Typed in for today.",
} as const;

/** "2300" → 2300 when it is a whole number in range, else null. */
const parseKcal = (text: string): number | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= KCAL_TARGET_MIN && n <= KCAL_TARGET_MAX ? n : null;
};

/**
 * Fitness targets (website: Phase tab + Day tab): type in daily calories, as a standing target from a date
 * or for today only, and move the phase's start date. Protein and fat stay per kg of trend weight; carbs
 * fill the rest. Everything goes through the outbox, so it works offline.
 */
export default function FitnessTargets() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const { data } = useFitnessDay(today);
  const seeded = useRef(false);
  const [standing, setStanding] = useState("");
  const [from, setFrom] = useState<ISODate>(today);
  const [dayKcal, setDayKcal] = useState("");
  const [phaseStart, setPhaseStart] = useState<ISODate>(today);
  const [msg, setMsg] = useState<{ where: "standing" | "day" | "phase"; text: string } | null>(null);

  const manual = data?.settings["fitness.manualKcal"] ?? null;
  const own = data?.body?.kcalOverride ?? null;
  const target = data?.targets ?? null;

  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    const base = String(data.targets?.kcal ?? data.maintenance.kcal);
    setStanding(String(data.settings["fitness.manualKcal"]?.kcal ?? base));
    setFrom(data.settings["fitness.manualKcal"]?.from ?? today);
    setDayKcal(String(data.body?.kcalOverride ?? base));
    if (data.phase) setPhaseStart(data.phase.startDate);
  }, [data, today]);

  const nudge = (text: string, delta: number, set: (v: string) => void) => {
    const base = Number(text) || (target?.kcal ?? data?.maintenance.kcal ?? 2000);
    set(String(Math.min(KCAL_TARGET_MAX, Math.max(KCAL_TARGET_MIN, Math.round(base / STEP) * STEP + delta))));
  };

  const input = (value: string, set: (v: string) => void, label: string) => (
    <Stepper
      minusLabel={`${label}: minus ${STEP} calories`}
      plusLabel={`${label}: plus ${STEP} calories`}
      onMinus={() => nudge(value, -STEP, set)}
      onPlus={() => nudge(value, STEP, set)}
      value={<KcalInput value={value} onChange={set} label={label} />}
    />
  );

  async function saveStanding() {
    const kcal = parseKcal(standing);
    if (kcal == null) return setMsg({ where: "standing", text: `Use a whole number from ${KCAL_TARGET_MIN} to ${n0(KCAL_TARGET_MAX)}.` });
    await setManualKcal({ kcal, from });
    tapDone();
    setMsg({ where: "standing", text: `Saved: ${n0(kcal)} kcal from ${longDate(from)}.` });
  }

  async function saveDay() {
    const kcal = parseKcal(dayKcal);
    if (kcal == null) return setMsg({ where: "day", text: `Use a whole number from ${KCAL_TARGET_MIN} to ${n0(KCAL_TARGET_MAX)}.` });
    await setKcalOverride(today, kcal);
    tapDone();
    setMsg({ where: "day", text: `Saved: ${n0(kcal)} kcal for today.` });
  }

  async function saveStart() {
    if (!data?.phase) return;
    const bad = await changePhaseStart(data.phase.id, phaseStart, today);
    if (bad) return setMsg({ where: "phase", text: PHASE_PROBLEM[bad] });
    tapDone();
    setMsg({ where: "phase", text: `Start date is now ${longDate(phaseStart)}.` });
  }

  return (
    <Screen sheet>
      <SheetHeader title="Fitness targets" subtitle="Calories and phase start date" onClose={() => router.back()} />

      <View style={s.hero} accessible accessibilityLabel={`Today's calories: ${target ? n0(target.kcal) : data ? n0(data.maintenance.kcal) : "unknown"} kcal`}>
        <Text style={s.fillLabel}>Today's calories</Text>
        <Text style={s.big}>{target ? `${n0(target.kcal)} kcal` : data ? `${n0(data.maintenance.kcal)} kcal` : "—"}</Text>
        <Text style={s.fillSmall}>{target ? SOURCE_TEXT[target.source] : "Log your weight to get targets; until then it sits at maintenance."}</Text>
      </View>

      <Card tone="surface">
        <Text style={s.heading}>Standing target</Text>
        <Text style={s.small}>
          {manual ? `Now ${n0(manual.kcal)} kcal a day since ${longDate(manual.from)}.` : "Not set: the target is calculated."} It applies from the date you pick until you
          switch back. Protein and fat stay per kg; carbs fill the rest.
        </Text>
        {input(standing, setStanding, "Standing calories")}
        <DateStepper label="Starts on" value={from} onChange={setFrom} />
        <BigButton label="Save standing target" onPress={() => void saveStanding()} variant="accent" />
        {manual ? (
          <BigButton
            label="Use the calculated target"
            variant="secondary"
            onPress={async () => {
              await setManualKcal(null);
              tapDone();
              setMsg({ where: "standing", text: "Back to the calculated target." });
            }}
          />
        ) : null}
        {msg?.where === "standing" ? <Text style={s.note}>{msg.text}</Text> : null}
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>Just today</Text>
        <Text style={s.small}>{own != null ? `Today is set to ${n0(own)} kcal.` : "Changes today only. Tomorrow goes back to the usual target."}</Text>
        {input(dayKcal, setDayKcal, "Calories for today")}
        <BigButton label="Save for today" onPress={() => void saveDay()} variant="accent" />
        {own != null ? (
          <BigButton
            label="Use the usual target"
            variant="secondary"
            onPress={async () => {
              await setKcalOverride(today, null);
              tapDone();
              setMsg({ where: "day", text: "Back to the usual target for today." });
            }}
          />
        ) : null}
        {msg?.where === "day" ? <Text style={s.note}>{msg.text}</Text> : null}
      </Card>

      {data?.phase ? (
        <Card tone="surface">
          <Text style={s.heading}>Phase start date</Text>
          <Text style={s.small}>{data.phaseText}. Week count and progress follow the start date; the phase before it ends the day before.</Text>
          <DateStepper label="Phase started on" value={phaseStart} onChange={setPhaseStart} max={today} />
          <BigButton label="Change start date" onPress={() => void saveStart()} variant="accent" disabled={phaseStart === data.phase.startDate} />
          {msg?.where === "phase" ? <Text style={s.note}>{msg.text}</Text> : null}
        </Card>
      ) : (
        <Card tone="surface">
          <Text style={s.heading}>Phase start date</Text>
          <Text style={s.small}>No phase is running. Start one on the website (Fitness → Phase) and its start date can be changed here.</Text>
        </Card>
      )}
    </Screen>
  );
}

function KcalInput(props: { value: string; onChange: (v: string) => void; label: string }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  return (
    <TextInput
      value={props.value}
      onChangeText={(v) => props.onChange(v.replace(/[^0-9]/g, ""))}
      keyboardType="number-pad"
      placeholder="—"
      placeholderTextColor={c.ink2}
      accessibilityLabel={props.label}
      maxLength={5}
      style={s.kcal}
    />
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    heading: { ...f(600, 17, 24), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    note: { ...f(600, 14, 20), color: c.ink },
    // The pastel card keeps its light fill in both themes, so its text is ink (fill.ink) in both.
    hero: { backgroundColor: fill.limeSoft, borderRadius: radius.card, padding: space(2.25), gap: space(0.5) },
    fillLabel: { ...f(600, 13, 18), color: fill.inkMuted },
    fillSmall: { ...f(500, 13, 18), color: fill.ink },
    big: { ...f(600, 40, 46), color: fill.ink, fontVariant: ["tabular-nums"] },
    kcal: { ...f(600, 36, 42), color: c.ink, minWidth: 120, textAlign: "center", paddingVertical: 0, fontVariant: ["tabular-nums"] },
    gap: { height: space(1) },
  });
