import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { Mission, MissionStatus } from "@tatakae/core";
import {
  homeRedirect,
  isLocked,
  logHabit,
  saveMission,
  setStatus,
  startFocus,
  useDay,
  useDayFlags,
  useDaysShownUp,
  useHabits,
  useSyncStatus,
  useToday,
  type MissionEdit,
} from "../../src/lib/hooks";
import { flush } from "../../src/sync/engine";
import { longDate } from "../../src/lib/format";
import { MissionCard } from "../../src/components/MissionCard";
import { HabitStrip } from "../../src/components/HabitStrip";
import { FitnessCard } from "../../src/components/FitnessCard";
import { DaysShownUp } from "../../src/components/DaysShownUp";
import { LockReasonModal } from "../../src/components/LockReasonModal";
import { BigButton } from "../../src/components/BigButton";
import { tapDone } from "../../src/haptics";
import { colors, minTarget, space, text, ui } from "../../src/theme";

// TODO(v1, docs/10 + docs/11): Header: greeting + date title, "+" (capture → /capture modal) and bell circles; WeekStrip;
// count chips (Done/Minimum/Open); P1HeroCard (lime Start arrow); P2 lavender + P3 lime-soft MissionCards; habits pills;
// 2 MetricCards (today score, days shown up). No streak.

/** Redirect at most once per app session per date and target, so Back never loops. */
const redirected = new Set<string>();

/** Today: P1–P3 + side quest with chips, habits strip, days shown up. No score before shutdown. */
export default function Today() {
  const today = useToday();
  const dayQ = useDay(today);
  const flagsQ = useDayFlags(today);
  const habitsQ = useHabits(today);
  const shownUp = useDaysShownUp();
  const sync = useSyncStatus();
  const [editing, setEditing] = useState<Mission | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const view = dayQ.data;
  const flags = flagsQ.data;

  useFocusEffect(
    useCallback(() => {
      if (!view || !flags) return;
      const target = homeRedirect(view, flags);
      if (!target) return;
      const key = `${target}:${view.date}`;
      if (redirected.has(key)) return;
      redirected.add(key);
      router.push(target);
    }, [view, flags]),
  );

  const onStatus = useCallback(async (m: Mission, s: MissionStatus) => {
    await setStatus(m, s);
    if (s === "done" || s === "minimum") tapDone();
  }, []);

  const onFocus = useCallback(
    async (m: Mission) => {
      await startFocus(m.id, view?.settings.focus_default ?? 50);
      router.navigate("/focus");
    },
    [view?.settings.focus_default],
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await flush();
    } finally {
      setRefreshing(false);
    }
  }

  const missions = view?.missions ?? [];
  const syncLine =
    sync.state === "offline"
      ? "Offline. Changes are saved on this phone and sync later."
      : sync.pending > 0
        ? `${sync.pending} ${sync.pending === 1 ? "change" : "changes"} waiting to sync`
        : null;

  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.muted} colors={[colors.ember]} progressBackgroundColor={colors.ink2} />}
      >
        <View style={styles.header}>
          <Text style={text.h1} accessibilityRole="header">
            {longDate(today)}
          </Text>
          <DaysShownUp count={shownUp.data} />
          {syncLine ? <Text style={text.small}>{syncLine}</Text> : null}
          {view?.day?.kind === "rest" ? <Text style={text.small}>Rest day. Nothing to log.</Text> : null}
          {view?.day?.kind === "write_off" ? <Text style={text.small}>Written off. It won't count either way.</Text> : null}
        </View>

        {view && missions.length === 0 ? (
          <View style={ui.card}>
            <Text style={text.h2}>No plan locked. Pick one Minimum now.</Text>
            <Text style={text.small}>One mission is enough. Plan the rest tonight on the laptop.</Text>
            <BigButton label="Plan P1" onPress={() => router.push("/morning")} />
          </View>
        ) : null}

        {missions.map((m) => (
          <MissionCard
            key={m.id}
            mission={m}
            locked={view ? isLocked(m, view) : false}
            onStatus={(s) => void onStatus(m, s)}
            onStuck={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: m.id } })}
            onFocus={() => void onFocus(m)}
            onEdit={() => setEditing(m)}
          />
        ))}

        <FitnessCard date={today} />

        <HabitStrip items={habitsQ.data ?? []} onToggle={(id, done) => void logHabit(id, today, done)} />

        {flags && !flags.closed ? (
          <Pressable
            onPress={() => router.push("/quick-close")}
            accessibilityRole="button"
            accessibilityHint="Close today here if you can't do the laptop ritual"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>Away from the laptop tonight? Quick close</Text>
          </Pressable>
        ) : null}
        {flags?.closed ? <Text style={text.small}>Day closed. Tomorrow's plan comes from the night ritual.</Text> : null}
      </ScrollView>

      <LockReasonModal
        mission={editing}
        locked={editing && view ? isLocked(editing, view) : false}
        onClose={() => setEditing(null)}
        onSave={async (patch: MissionEdit, reason) => {
          if (!editing || !view) return;
          await saveMission(editing, patch, view, reason ?? undefined);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(2), gap: space(2), paddingBottom: space(6) },
  header: { gap: space(1), marginBottom: space(1) },
  link: { minHeight: minTarget, justifyContent: "center" },
  linkText: { color: colors.paper, fontSize: 16, textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
});
