import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { Mission } from "@tatakae/core";
import { pauseFocus, resumeFocus, startFocus, stopFocus, useDay, useFocusSession, useMission, useSettings, useToday } from "../../src/lib/hooks";
import { formatClock, isPaused, progress, remainingMs, spokenRemaining } from "../../src/focus/timer";
import { FocusRing } from "../../src/components/FocusRing";
import { BigButton } from "../../src/components/BigButton";
import { SegmentedPills } from "../../src/components/SegmentedPills";
import { TextField } from "../../src/components/TextField";
import { Card, Screen, ScreenHeader } from "../../src/components/Screen";
import { SLOT_LABEL } from "../../src/components/MissionCard";
import { tapDone, tapTimerEnd } from "../../src/haptics";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, type Theme } from "../../src/lib/theme";

const KEEP_AWAKE_TAG = "tatakae-focus";

/** 25 · 50 · 90, plus the default from Settings when it is another length (any 5–240, R3-9). */
function lengthsFor(def: number): { value: number; label: string }[] {
  const set = [...new Set([25, 50, 90, def])].sort((a, b) => a - b);
  return set.map((v) => ({ value: v, label: String(v) }));
}

/** Re-render once a second while visible. Time is always derived from the stored start time. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Focus (docs/10 §6): huge countdown in a lime ring, mission title, Pause / Done / Stuck, resume note. */
export default function Focus() {
  const s = useStyles(makeStyles);
  const { data: session } = useFocusSession();
  const { data: mission } = useMission(session?.missionId);
  const { data: settings } = useSettings();
  const params = useLocalSearchParams<{ start?: string }>();

  // "Start" on the home-screen widget opens tatakae://focus?start=<P1 id>: start a block at the
  // default length, unless one is already running.
  useEffect(() => {
    const id = typeof params.start === "string" ? params.start : "";
    if (id === "" || session === undefined || !settings) return;
    router.setParams({ start: undefined });
    if (!session) void startFocus(id, settings.focus_default);
  }, [params.start, session, settings]);
  const [visible, setVisible] = useState(false);
  const [ending, setEnding] = useState(false);
  const [note, setNote] = useState("");
  const endedFor = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );

  const running = !!session && !isPaused(session);
  const now = useNow(visible && running);

  // Keep the screen on only while this screen is visible and a block is running.
  useEffect(() => {
    if (!(visible && running)) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [visible, running]);

  const remaining = session ? remainingMs(session, now) : 0;
  const finished = !!session && remaining === 0;

  useEffect(() => {
    if (!session) {
      setEnding(false);
      setNote("");
      endedFor.current = null;
      return;
    }
    if (finished && endedFor.current !== session.startedAt) {
      endedFor.current = session.startedAt;
      tapTimerEnd();
      setEnding(true);
    }
  }, [session, finished]);

  // Prefill the resume note from the mission once per mission.
  const prefilled = useRef<string | null>(null);
  useEffect(() => {
    if (!mission || prefilled.current === mission.id) return;
    prefilled.current = mission.id;
    setNote(mission.resumeNote ?? "");
  }, [mission]);

  async function finish(status?: "done" | "minimum") {
    await stopFocus({ resumeNote: note, status });
    if (status) tapDone();
    router.push("/recharge");
  }

  if (!session) return <IdleFocus />;

  return (
    <Screen tab>
      <View style={s.titleBlock}>
        <Text style={s.slot}>{mission ? SLOT_LABEL[mission.slot] : "Focus"}</Text>
        <Text style={s.title} accessibilityRole="header" numberOfLines={3}>
          {mission?.title ?? "Focus block"}
        </Text>
        {mission?.minimum ? <Text style={s.line}>Minimum · {mission.minimum}</Text> : null}
      </View>

      <View style={s.ringWrap}>
        <FocusRing progress={progress(session, now)} accessibilityLabel={spokenRemaining(remaining)}>
          <Text style={s.clock} accessibilityElementsHidden importantForAccessibility="no">
            {formatClock(remaining)}
          </Text>
          <Text style={s.line}>{isPaused(session) ? "Paused" : finished ? "Block done" : `${session.length} min block`}</Text>
        </FocusRing>
      </View>

      {ending ? (
        <Card>
          <Text style={s.cardTitle}>{finished ? "Block done. How did it go?" : "Stopping here."}</Text>
          <TextField
            tone="surface"
            label="Where will you pick it up next time?"
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            placeholder="e.g. Next: wire the subnet output into the module"
            accessibilityLabel="Resume note"
          />
          <View style={s.row}>
            <BigButton label="Done" icon="done" variant="accent" onPress={() => void finish("done")} style={s.flex} />
            <BigButton label="Minimum" icon="minimum" variant="secondary" onPress={() => void finish("minimum")} style={s.flex} />
          </View>
          <BigButton label="Save note, not finished yet" variant="primary" onPress={() => void finish()} />
          {!finished ? <BigButton label="Keep going" variant="quiet" onPress={() => setEnding(false)} /> : null}
        </Card>
      ) : (
        <>
          <View style={s.row}>
            <BigButton
              label={isPaused(session) ? "Resume" : "Pause"}
              icon={isPaused(session) ? "play" : "pause"}
              variant="secondary"
              onPress={() => void (isPaused(session) ? resumeFocus() : pauseFocus())}
              style={s.flex}
            />
            <BigButton label="Done" icon="done" variant="accent" onPress={() => void finish("done")} style={s.flex} />
            <BigButton
              label="Stuck"
              icon="stuck"
              variant="secondary"
              onPress={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: session.missionId } })}
              style={s.flex}
            />
          </View>
          <View style={s.row}>
            <BigButton label="Minimum" icon="minimum" variant="secondary" onPress={() => void finish("minimum")} style={s.flex} />
            <BigButton label="Stop" variant="secondary" onPress={() => setEnding(true)} style={s.flex} />
          </View>
          {mission?.resumeNote ? (
            <Card>
              <Text style={s.slot}>Resume note</Text>
              <Text style={s.body}>{mission.resumeNote}</Text>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** No block running: pick a mission (P1 first) and a length. */
function IdleFocus() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const { data: view } = useDay(today);
  const open = (view?.missions ?? []).filter((m) => m.status === "open");
  const [picked, setPicked] = useState<string | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const chosen: Mission | undefined = open.find((m) => m.id === picked) ?? open[0];
  const def = view?.settings.focus_default ?? 50;
  const len = length ?? def;

  return (
    <Screen tab>
      <ScreenHeader title="Focus" />
      {open.length === 0 ? (
        <Text style={s.body}>Nothing open today. Plan a P1 from Today, or rest.</Text>
      ) : (
        <>
          <View style={s.pickList} accessibilityRole="radiogroup" accessibilityLabel="Mission to focus on">
            {open.map((m) => {
              const selected = chosen?.id === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setPicked(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [s.pick, selected && s.pickSelected, pressed && pressedStyle]}
                >
                  <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
                  <View style={s.flex}>
                    <Text style={s.slot}>{SLOT_LABEL[m.slot]}</Text>
                    <Text style={s.body}>{m.title}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <SegmentedPills options={lengthsFor(def)} value={len} onChange={setLength} accessibilityLabel="Focus length in minutes" stretch />
          <BigButton
            label={`Start ${len} min`}
            variant="accent"
            size="large"
            onPress={() => {
              if (chosen) void startFocus(chosen.id, len);
            }}
            disabled={!chosen}
          />
        </>
      )}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    titleBlock: { gap: space(0.5), marginTop: space(1) },
    slot: { ...f(600, 13, 18), color: c.ink2 },
    title: { ...f(600, 24, 30), color: c.ink },
    line: { ...f(500, 14, 20), color: c.ink2 },
    body: { ...f(400, 16, 24), color: c.ink },
    cardTitle: { ...f(600, 18, 24), color: c.ink },
    ringWrap: { alignItems: "center", paddingVertical: space(1) },
    clock: { ...f(600, 60, 66), color: c.ink, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
    row: { flexDirection: "row", gap: space(1) },
    flex: { flex: 1 },
    pickList: { gap: space(1) },
    pick: {
      minHeight: minTarget + 16,
      flexDirection: "row",
      alignItems: "center",
      gap: space(1.5),
      padding: space(2),
      borderRadius: radius.inner,
      backgroundColor: c.surface2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    pickSelected: { borderColor: c.ink },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.ink2, alignItems: "center", justifyContent: "center" },
    radioOn: { borderColor: c.ink },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink },
  });
