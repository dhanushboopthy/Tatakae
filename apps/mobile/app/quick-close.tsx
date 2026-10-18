import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { isNightTime, istTimeHHMM, type MissionStatus } from "@tatakae/core";
import { logHabit, setDayFlag, setStatus, updateDay, useDay, useHabits, useToday } from "../src/lib/hooks";
import { SLOT_LABEL } from "../src/components/MissionCard";
import { StatusChips } from "../src/components/StatusChips";
import { HabitStrip } from "../src/components/HabitStrip";
import { Stepper } from "../src/components/fitnessUi";
import { BigButton } from "../src/components/BigButton";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { tapDone } from "../src/haptics";
import { f, space } from "../src/theme";
import { useForceDark, useStyles, useTheme, type Theme } from "../src/lib/theme";

const SCREEN_STEP = 15;

/**
 * Quick close (docs/05: ≤ 45 s) — the fallback when the laptop ritual is missed: mission statuses,
 * habits and screen minutes, then "Close the day". It never plans tomorrow; that stays on the laptop.
 * Dark after ritual time.
 */
export default function QuickClose() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const today = useToday();
  const { data: view } = useDay(today);
  const habits = useHabits(today);
  const [screen, setScreen] = useState("");
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  const night = view ? isNightTime(istTimeHHMM(), view.settings.ritual_time, view.settings.wake_time) : false;
  useForceDark(night);

  useEffect(() => {
    if (!view || seeded.current) return;
    seeded.current = true;
    if (view.day?.screenMin != null) setScreen(String(view.day.screenMin));
  }, [view]);

  const missions = (view?.missions ?? []).filter((m) => m.status !== "rescheduled");
  const minutes = screen.trim() === "" ? null : Number(screen);
  const minutesOk = minutes === null || (Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440);

  function nudge(delta: number) {
    const base = minutes != null && Number.isFinite(minutes) ? minutes : 0;
    setScreen(String(Math.min(1440, Math.max(0, base + delta))));
  }

  async function close() {
    if (busy || !minutesOk) return;
    setBusy(true);
    try {
      if (minutes !== (view?.day?.screenMin ?? null)) await updateDay(today, { screenMin: minutes });
      await setDayFlag(today, "closed");
      tapDone();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      sheet
      footer={<BigButton label="Close the day" onPress={() => void close()} busy={busy} disabled={!minutesOk} size="large" accessibilityHint="Saves today. Tomorrow is planned on the laptop." />}
    >
      <SheetHeader title="Quick close" subtitle="Three things, under a minute. Planning stays on the laptop." onClose={() => router.back()} />

      {missions.length === 0 ? (
        <Card tone="surface">
          <Text style={s.body}>Nothing was planned today. That's fine — close it and rest.</Text>
        </Card>
      ) : (
        missions.map((m) => (
          <Card key={m.id} tone="surface">
            <Text style={s.slot}>{SLOT_LABEL[m.slot]}</Text>
            <Text style={s.title}>{m.title}</Text>
            <View style={s.chipsWrap}>
              <StatusChips status={m.status} onChange={(st: MissionStatus) => void setStatus(m, st)} hideReschedule missionTitle={m.title} />
            </View>
          </Card>
        ))
      )}

      <Card tone="surface">
        <HabitStrip items={habits.data ?? []} onToggle={(id, done) => void logHabit(id, today, done)} />
        {(habits.data?.length ?? 0) === 0 ? <Text style={s.small}>No habits set up. Add them on the laptop.</Text> : null}
      </Card>

      <Card tone="surface">
        <Text style={s.slot}>Screen minutes today</Text>
        <Text style={s.small}>Recreational apps only. Free under 120.</Text>
        <Stepper
          minusLabel={`Minus ${SCREEN_STEP} minutes`}
          plusLabel={`Plus ${SCREEN_STEP} minutes`}
          onMinus={() => nudge(-SCREEN_STEP)}
          onPlus={() => nudge(SCREEN_STEP)}
          value={
            <TextInput
              value={screen}
              onChangeText={(v) => setScreen(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={c.ink2}
              accessibilityLabel="Screen minutes today"
              maxLength={4}
              style={s.minutes}
            />
          }
        />
        {!minutesOk ? <Text style={s.small}>Use a whole number of minutes, up to 1440.</Text> : null}
      </Card>
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(400, 16, 24), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    slot: { ...f(600, 13, 18), color: c.ink2 },
    title: { ...f(600, 18, 24), color: c.ink },
    chipsWrap: { marginTop: space(0.5) },
    minutes: { ...f(600, 40, 46), color: c.ink, minWidth: 110, textAlign: "center", paddingVertical: 0, fontVariant: ["tabular-nums"] },
  });
