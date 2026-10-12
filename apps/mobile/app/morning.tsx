import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { FocusLength } from "@tatakae/core";
import { planP1, setDayFlag, startFocus, updateDay, useDay, useToday } from "../src/lib/hooks";
import { longDate } from "../src/lib/format";
import { P1Card } from "../src/components/P1Card";
import { P1QuickForm } from "../src/components/P1QuickForm";
import { BigButton } from "../src/components/BigButton";
import { Choice } from "../src/components/Choice";
import { SLOT_LABEL } from "../src/components/MissionCard";
import { tapDone } from "../src/haptics";
import { colors, minTarget, space, text, ui } from "../src/theme";

const LENGTHS: readonly { value: FocusLength; label: string }[] = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 90, label: "90" },
];

/**
 * ONE screen: "What would make today a win?", the P1 card (title, Minimum, if-then) and Start.
 * P2/P3 stay behind a link. Never a story line here. Target: Start within 10 seconds.
 */
export default function Morning() {
  const today = useToday();
  const { data: view } = useDay(today);
  const [intention, setIntention] = useState("");
  const [length, setLength] = useState<FocusLength>(50);
  const [showRest, setShowRest] = useState(false);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!view || loaded.current) return;
    loaded.current = true;
    setIntention(view.day?.intention ?? "");
    setLength(view.settings.focus_default);
  }, [view]);

  async function saveIntention() {
    const v = intention.trim();
    if (!view || v === (view.day?.intention ?? "")) return;
    await updateDay(today, { intention: v.slice(0, 200) || null });
  }

  async function start() {
    if (!view?.p1 || busy) return;
    setBusy(true);
    try {
      await saveIntention();
      await startFocus(view.p1.id, length);
      tapDone();
      router.dismissTo("/focus");
    } finally {
      setBusy(false);
    }
  }

  async function defer() {
    await saveIntention();
    await setDayFlag(today, "morningDeferred");
    router.dismissTo("/");
  }

  const others = (view?.missions ?? []).filter((m) => m.slot !== "P1");

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={text.small}>{longDate(today)}</Text>

          <View style={styles.field}>
            <Text style={text.h2} nativeID="intentionLabel">
              What would make today a win?
            </Text>
            <TextInput
              style={ui.input}
              value={intention}
              onChangeText={setIntention}
              onBlur={() => void saveIntention()}
              onSubmitEditing={() => void saveIntention()}
              maxLength={200}
              returnKeyType="done"
              placeholder="One line is plenty"
              placeholderTextColor={colors.muted}
              accessibilityLabelledBy="intentionLabel"
              accessibilityLabel="What would make today a win?"
            />
          </View>

          {view?.p1 ? (
            <P1Card mission={view.p1}>
              <Choice options={LENGTHS} value={length} onChange={setLength} accessibilityLabel="Focus length in minutes" />
              <BigButton label={`Start ${length} min`} onPress={() => void start()} busy={busy} size="large" accessibilityHint="Starts a focus block on P1" />
            </P1Card>
          ) : view ? (
            <View style={ui.card}>
              <Text style={text.h2}>No plan locked. Pick one Minimum now.</Text>
              <P1QuickForm
                submitLabel="Plan P1"
                onSubmit={async (f) => {
                  // A forged day without a live P1 (it was rescheduled) still needs a lock reason.
                  await planP1(today, f, view.forged ? { lockReason: "Re-planned P1 in the morning" } : undefined);
                  tapDone();
                }}
              />
            </View>
          ) : null}

          <View style={styles.links}>
            {others.length > 0 ? (
              <Link label={showRest ? "Hide P2/P3" : "Show P2/P3"} onPress={() => setShowRest((v) => !v)} />
            ) : null}
            {view?.p1 ? (
              <Link label="Stuck" onPress={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: view.p1?.id ?? "" } })} />
            ) : null}
            <Link label="Defer" onPress={() => void defer()} hint="Go to Today without starting. You won't be asked again today." />
          </View>

          {showRest
            ? others.map((m) => (
                <View key={m.id} style={styles.otherRow}>
                  <Text style={text.label}>{SLOT_LABEL[m.slot]}</Text>
                  <Text style={text.body}>{m.title}</Text>
                </View>
              ))
            : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Link({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space(2), paddingTop: space(3), gap: space(3), paddingBottom: space(6) },
  field: { gap: space(1) },
  links: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  link: { minHeight: minTarget, minWidth: minTarget, justifyContent: "center" },
  linkText: { color: colors.paper, fontSize: 16, textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
  otherRow: { gap: 2, paddingVertical: space(1), borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
});
