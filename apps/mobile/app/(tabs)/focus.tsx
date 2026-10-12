import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { FocusLength, Mission } from "@tatakae/core";
import {
  pauseFocus,
  resumeFocus,
  startFocus,
  stopFocus,
  useDay,
  useFocusSession,
  useMission,
  useToday,
} from "../../src/lib/hooks";
import { formatClock, isPaused, progress, remainingMs, spokenRemaining } from "../../src/focus/timer";
import { ProgressRing } from "../../src/components/ProgressRing";
import { BigButton } from "../../src/components/BigButton";
import { Choice } from "../../src/components/Choice";
import { SLOT_LABEL } from "../../src/components/MissionCard";
import { tapDone, tapTimerEnd } from "../../src/haptics";
import { colors, minTarget, radius, space, text, tnum, type, ui } from "../../src/theme";

const KEEP_AWAKE_TAG = "tatakae-focus";
const LENGTHS: readonly { value: FocusLength; label: string }[] = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 90, label: "90" },
];

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

export default function Focus() {
  const { data: session } = useFocusSession();
  const { data: mission } = useMission(session?.missionId);
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
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBlock}>
            <Text style={text.label}>{mission ? SLOT_LABEL[mission.slot] : "Focus"}</Text>
            <Text style={text.h1} accessibilityRole="header" numberOfLines={3}>
              {mission?.title ?? "Focus block"}
            </Text>
            {mission?.minimum ? <Text style={text.small}>Minimum: {mission.minimum}</Text> : null}
          </View>

          <View style={styles.ringWrap}>
            <ProgressRing progress={progress(session, now)} accessibilityLabel={spokenRemaining(remaining)}>
              <Text style={[styles.clock, tnum]} accessibilityElementsHidden importantForAccessibility="no">
                {formatClock(remaining)}
              </Text>
              <Text style={text.small}>{isPaused(session) ? "Paused" : finished ? "Block done" : `${session.length} min block`}</Text>
            </ProgressRing>
          </View>

          {mission?.resumeNote && !ending ? (
            <View style={ui.card}>
              <Text style={text.label}>Resume note</Text>
              <Text style={text.body}>{mission.resumeNote}</Text>
            </View>
          ) : null}

          {ending ? (
            <View style={ui.card}>
              <Text style={text.h2}>{finished ? "Block done. How did it go?" : "Stopping here."}</Text>
              <Text style={text.label} nativeID="noteLabel">
                Where will you pick it up next time?
              </Text>
              <TextInput
                style={[ui.input, styles.note]}
                value={note}
                onChangeText={setNote}
                maxLength={500}
                multiline
                placeholder="e.g. Next: wire the subnet output into the module"
                placeholderTextColor={colors.muted}
                accessibilityLabelledBy="noteLabel"
                accessibilityLabel="Resume note"
              />
              <View style={styles.row}>
                <BigButton label="Done" glyph="✓" onPress={() => void finish("done")} style={styles.flex} />
                <BigButton label="Minimum" glyph="½" variant="secondary" onPress={() => void finish("minimum")} style={styles.flex} />
              </View>
              <BigButton label="Save note, not finished yet" variant="secondary" onPress={() => void finish()} />
              {!finished ? <BigButton label="Keep going" variant="quiet" onPress={() => setEnding(false)} /> : null}
            </View>
          ) : (
            <View style={styles.actions}>
              <BigButton
                label={isPaused(session) ? "Resume" : "Pause"}
                variant="secondary"
                onPress={() => void (isPaused(session) ? resumeFocus() : pauseFocus())}
              />
              <View style={styles.row}>
                <BigButton label="Done" glyph="✓" onPress={() => void finish("done")} style={styles.flex} />
                <BigButton label="Minimum" glyph="½" variant="secondary" onPress={() => void finish("minimum")} style={styles.flex} />
              </View>
              <View style={styles.row}>
                <BigButton
                  label="Stuck"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: session.missionId } })}
                  style={styles.flex}
                />
                <BigButton label="Stop" variant="secondary" onPress={() => setEnding(true)} style={styles.flex} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** No block running: pick a mission (P1 first) and a length. */
function IdleFocus() {
  const today = useToday();
  const { data: view } = useDay(today);
  const open = (view?.missions ?? []).filter((m) => m.status === "open");
  const [picked, setPicked] = useState<string | null>(null);
  const [length, setLength] = useState<FocusLength | null>(null);
  const chosen: Mission | undefined = open.find((m) => m.id === picked) ?? open[0];
  const len = length ?? view?.settings.focus_default ?? 50;

  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={text.h1} accessibilityRole="header">
          Focus
        </Text>
        {open.length === 0 ? (
          <Text style={text.body}>Nothing open today. Plan a P1 from Today, or rest.</Text>
        ) : (
          <>
            <View style={styles.pickList} accessibilityRole="radiogroup" accessibilityLabel="Mission to focus on">
              {open.map((m) => {
                const selected = chosen?.id === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setPicked(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.pick, selected && styles.pickSelected]}
                  >
                    <Text style={styles.pickGlyph}>{selected ? "◉" : "○"}</Text>
                    <View style={styles.flex}>
                      <Text style={text.label}>{SLOT_LABEL[m.slot]}</Text>
                      <Text style={text.body}>{m.title}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Choice options={LENGTHS} value={len} onChange={setLength} accessibilityLabel="Focus length in minutes" />
            <BigButton
              label={`Start ${len} min`}
              size="large"
              onPress={() => {
                if (chosen) void startFocus(chosen.id, len);
              }}
              disabled={!chosen}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space(2), gap: space(3), paddingBottom: space(6) },
  titleBlock: { gap: space(0.5) },
  ringWrap: { alignItems: "center" },
  clock: { color: colors.paper, fontSize: type.timer - 8, fontWeight: "600" },
  actions: { gap: space(1.5) },
  row: { flexDirection: "row", gap: space(1) },
  flex: { flex: 1 },
  note: { minHeight: 88, textAlignVertical: "top" },
  pickList: { gap: space(1) },
  pick: {
    minHeight: minTarget + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    padding: space(1.5),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ink2,
  },
  pickSelected: { borderColor: colors.paper, borderWidth: 2 },
  pickGlyph: { color: colors.paper, fontSize: type.h2 },
});
