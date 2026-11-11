import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { istTimeHHMM, type Mission, type MissionStatus } from "@tatakae/core";
import {
  homeRedirect,
  isLocked,
  logHabit,
  saveMission,
  setStatus,
  startFocus,
  useDay,
  useDayFlags,
  useHabits,
  useScoreboard,
  useSyncStatus,
  useToday,
  useWeekDays,
  type MissionEdit,
} from "../../src/lib/hooks";
import { flush } from "../../src/sync/engine";
import { greeting, titleDate } from "../../src/lib/format";
import { MissionCard } from "../../src/components/MissionCard";
import { P1HeroCard } from "../../src/components/P1HeroCard";
import { StatusChips } from "../../src/components/StatusChips";
import { HabitStrip } from "../../src/components/HabitStrip";
import { FitnessCard } from "../../src/components/FitnessCard";
import { WeekStrip } from "../../src/components/WeekStrip";
import { Scoreboard } from "../../src/components/Scoreboard";
import { IconCircle } from "../../src/components/IconCircle";
import { Icon, type AppIcon } from "../../src/components/Icon";
import { Card, Screen, ScreenHeader } from "../../src/components/Screen";
import { LockReasonModal } from "../../src/components/LockReasonModal";
import { BigButton } from "../../src/components/BigButton";
import { tapDone } from "../../src/haptics";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../../src/lib/theme";

/** Redirect at most once per app session per date and target, so Back never loops. */
const redirected = new Set<string>();

/**
 * Today (docs/10 §6, mockup Phone-Today): greeting + date with + and bell circles, week strip,
 * count chips, P1 hero, P2…P9 + side quest cards, fitness, habits, two scoreboard boxes.
 * No streak, no red, no score before shutdown.
 */
export default function Today() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const today = useToday();
  const dayQ = useDay(today);
  const flagsQ = useDayFlags(today);
  const habitsQ = useHabits(today);
  const week = useWeekDays(today);
  const board = useScoreboard();
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

  const onStatus = useCallback(async (m: Mission, st: MissionStatus) => {
    await setStatus(m, st);
    if (st === "done" || st === "minimum") tapDone();
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
  const p1 = view?.p1 ?? null;
  const others = missions.filter((m) => m.id !== p1?.id);
  const scored = missions.filter((m) => m.slot !== "side" && m.status !== "rescheduled");
  const counts = {
    done: scored.filter((m) => m.status === "done").length,
    minimum: scored.filter((m) => m.status === "minimum").length,
    open: scored.filter((m) => m.status === "open").length,
  };
  const syncLine =
    sync.state === "offline"
      ? "Offline. Changes are saved on this phone and sync later."
      : sync.pending > 0
        ? `${sync.pending} ${sync.pending === 1 ? "change" : "changes"} waiting to sync`
        : null;

  return (
    <Screen
      tab
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.ink2} colors={[c.ink]} progressBackgroundColor={c.surface2} />}
    >
      <ScreenHeader
        eyebrow={greeting(istTimeHHMM())}
        title={titleDate(today)}
        right={
          <>
            <IconCircle icon="capture" variant="primary" onPress={() => router.push("/capture")} accessibilityLabel="Capture" accessibilityHint="Save a thought to the inbox" />
            <IconCircle icon="reminders" variant="soft" onPress={() => router.navigate("/settings")} accessibilityLabel="Reminders" accessibilityHint="Reminder times are in Settings" />
          </>
        }
      />

      {week.data ? <WeekStrip days={week.data} today={today} onSelect={(d) => d !== today && router.push({ pathname: "/day/[date]", params: { date: d } })} /> : null}

      {syncLine ? (
        <View style={s.syncRow}>
          <Icon name={sync.state === "offline" ? "offline" : "sync"} size={16} color={c.ink2} />
          <Text style={s.small}>{syncLine}</Text>
        </View>
      ) : null}
      {view?.day?.kind === "rest" ? <Text style={s.small}>Rest day. Nothing to log.</Text> : null}
      {view?.day?.kind === "write_off" ? <Text style={s.small}>Written off. It won't count either way.</Text> : null}

      {missions.length > 0 ? (
        <View style={s.counts}>
          <CountChip label="Done" n={counts.done} icon="done" strong />
          <CountChip label="Minimum" n={counts.minimum} icon="minimum" />
          <CountChip label="Open" n={counts.open} />
        </View>
      ) : null}

      {view && missions.length === 0 ? (
        <Card tone="limeSoft">
          <Text style={s.emptyTitle}>No plan locked. Pick one Minimum now.</Text>
          <Text style={s.emptyLine}>One mission is enough. Plan the rest tonight on the laptop.</Text>
          <BigButton label="Plan P1" onPress={() => router.push("/morning")} />
        </Card>
      ) : null}

      {p1 && view ? (
        <P1HeroCard
          mission={p1}
          onStart={() => void onFocus(p1)}
          status={p1.status === "done" ? "Done ✓" : p1.status === "minimum" ? "Minimum ◐" : isLocked(p1, view) ? "Plan locked" : undefined}
        >
          <StatusChips status={p1.status} onChange={(st) => void onStatus(p1, st)} missionTitle={p1.title} />
          <View style={s.heroLinks}>
            {p1.status === "open" ? (
              <HeroLink label="Stuck" icon="stuck" onPress={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: p1.id } })} />
            ) : null}
            <HeroLink label="Edit" icon="edit" onPress={() => setEditing(p1)} />
          </View>
        </P1HeroCard>
      ) : null}

      {others.map((m) => (
        <MissionCard
          key={m.id}
          mission={m}
          locked={view ? isLocked(m, view) : false}
          onStatus={(st) => void onStatus(m, st)}
          onStuck={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: m.id } })}
          onFocus={() => void onFocus(m)}
          onEdit={() => setEditing(m)}
        />
      ))}

      <FitnessCard date={today} />

      <HabitStrip items={habitsQ.data ?? []} onToggle={(id, done) => void logHabit(id, today, done)} />

      {board.data ? <Scoreboard boxes={board.data} keys={["days_shown_up", "today_score"]} /> : null}

      {flags && !flags.closed ? (
        <Pressable
          onPress={() => router.push("/quick-close")}
          accessibilityRole="button"
          accessibilityHint="Close today here if you can't do the laptop ritual"
          style={({ pressed }) => [s.link, pressed && pressedStyle]}
        >
          <Icon name="ritual" size={18} color={c.ink} />
          <Text style={s.linkText}>Away from the laptop tonight? Quick close</Text>
        </Pressable>
      ) : null}
      {flags?.closed ? <Text style={s.small}>Day closed. Tomorrow's plan comes from the night ritual.</Text> : null}

      <LockReasonModal
        mission={editing}
        locked={editing && view ? isLocked(editing, view) : false}
        onClose={() => setEditing(null)}
        onSave={async (patch: MissionEdit, reason) => {
          if (!editing || !view) return;
          await saveMission(editing, patch, view, reason ?? undefined);
        }}
      />
    </Screen>
  );
}

/** Count chip with a number bubble (ref 02). Display only; the label says what it counts. */
function CountChip({ label, n, icon, strong }: { label: string; n: number; icon?: AppIcon; strong?: boolean }) {
  const s = useStyles(makeStyles);
  return (
    <View style={[s.count, strong && n > 0 && s.countStrong]} accessible accessibilityLabel={`${label}: ${n}`}>
      {icon ? <Icon name={icon} size={14} color={strong && n > 0 ? s.countTextOn.color : s.countText.color} strokeWidth={2} /> : null}
      <Text style={[s.countText, strong && n > 0 && s.countTextOn]}>{label}</Text>
      <View style={[s.bubble, strong && n > 0 && s.bubbleOn]}>
        <Text style={[s.bubbleText, strong && n > 0 && s.countTextOn]}>{n}</Text>
      </View>
    </View>
  );
}

/** Outline action on the charcoal hero (Stuck, Edit). */
function HeroLink({ label, icon, onPress }: { label: string; icon: AppIcon; onPress: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.heroLink, pressed && pressedStyle]}>
      <Icon name={icon} size={16} color={s.heroLinkText.color} strokeWidth={2} />
      <Text style={s.heroLinkText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ c, t }: Theme) =>
  StyleSheet.create({
    small: { ...t.secondary },
    syncRow: { flexDirection: "row", alignItems: "center", gap: space(1) },
    counts: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    count: { flexDirection: "row", alignItems: "center", gap: space(0.75), backgroundColor: c.surface2, borderRadius: radius.pill, paddingLeft: space(1.75), paddingRight: 6, paddingVertical: 6 },
    countStrong: { backgroundColor: c.limeSoft },
    countText: { ...f(600, 13), color: c.ink },
    countTextOn: { color: c.onFill },
    bubble: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    bubbleOn: { backgroundColor: c.lime },
    bubbleText: { ...f(600, 13), color: c.ink, fontVariant: ["tabular-nums"] },
    emptyTitle: { ...f(600, 19, 25), color: c.onFill },
    emptyLine: { ...f(500, 14, 20), color: c.onFillMuted },
    heroLinks: { flexDirection: "row", gap: space(0.75) },
    heroLink: { minHeight: minTarget, paddingHorizontal: space(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: c.heroLine, flexDirection: "row", alignItems: "center", gap: 6 },
    heroLinkText: { ...f(600, 13), color: c.onHero },
    link: { minHeight: minTarget, flexDirection: "row", alignItems: "center", gap: space(1) },
    linkText: { ...f(600, 15), color: c.ink, textDecorationLine: "underline" },
  });
