import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { istTimeHHMM } from "@tatakae/core";
import { planP1, setDayFlag, startFocus, updateDay, useDay, useToday } from "../src/lib/hooks";
import { greeting, titleDate } from "../src/lib/format";
import { P1HeroCard } from "../src/components/P1HeroCard";
import { P1QuickForm } from "../src/components/P1QuickForm";
import { BigButton } from "../src/components/BigButton";
import { SegmentedPills } from "../src/components/SegmentedPills";
import { TextField } from "../src/components/TextField";
import { Card, Screen, ScreenHeader } from "../src/components/Screen";
import { SLOT_LABEL } from "../src/components/MissionCard";
import { tapDone } from "../src/haptics";
import { f, minTarget, space } from "../src/theme";
import { pressedStyle, useStyles, type Theme } from "../src/lib/theme";

/** 25 · 50 · 90, plus the default from Settings when it is another length (any 5–240, R3-9). */
function lengthsFor(def: number): { value: number; label: string }[] {
  const set = [...new Set([25, 50, 90, def])].sort((a, b) => a - b);
  return set.map((v) => ({ value: v, label: String(v) }));
}

/**
 * ONE screen: greeting, "What would make today a win?", the tall P1 hero and Start lengths.
 * P2/P3 stay behind a link. Never a story line here. Target: Start within 10 seconds.
 */
export default function Morning() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const { data: view } = useDay(today);
  const [intention, setIntention] = useState("");
  const [length, setLength] = useState(50);
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
    <Screen>
      <ScreenHeader eyebrow={greeting(istTimeHHMM())} title={titleDate(today)} />

      <Card>
        <TextField
          label="What would make today a win?"
          tone="surface"
          value={intention}
          onChangeText={setIntention}
          onBlur={() => void saveIntention()}
          onSubmitEditing={() => void saveIntention()}
          maxLength={200}
          returnKeyType="done"
          placeholder="One line is plenty"
        />
      </Card>

      {view?.p1 ? (
        <>
          <P1HeroCard mission={view.p1} tall onStart={() => void start()} startLabel={`Start ${length} minutes on P1`} />
          <SegmentedPills options={lengthsFor(view.settings.focus_default)} value={length} onChange={setLength} accessibilityLabel="Focus length in minutes" stretch />
          <BigButton label={`Start ${length} min`} variant="accent" onPress={() => void start()} busy={busy} size="large" accessibilityHint="Starts a focus block on P1" />
        </>
      ) : view ? (
        <Card>
          <Text style={s.cardTitle}>No plan locked. Pick one Minimum now.</Text>
          <P1QuickForm
            tone="surface"
            submitLabel="Plan P1"
            onSubmit={async (fields) => {
              // A forged day without a live P1 (it was rescheduled) still needs a lock reason.
              await planP1(today, fields, view.forged ? { lockReason: "Re-planned P1 in the morning" } : undefined);
              tapDone();
            }}
          />
        </Card>
      ) : null}

      <View style={s.links}>
        {others.length > 0 ? <Link label={showRest ? "Hide the rest" : "Show the rest"} onPress={() => setShowRest((v) => !v)} /> : null}
        {view?.p1 ? <Link label="Stuck" onPress={() => router.push({ pathname: "/stuck/[missionId]", params: { missionId: view.p1?.id ?? "" } })} /> : null}
        <Link label="Defer" onPress={() => void defer()} hint="Go to Today without starting. You won't be asked again today." />
      </View>

      {showRest
        ? others.map((m) => (
            <View key={m.id} style={s.otherRow}>
              <Text style={s.otherSlot}>{SLOT_LABEL[m.slot]}</Text>
              <Text style={s.otherTitle}>{m.title}</Text>
            </View>
          ))
        : null}
    </Screen>
  );
}

function Link({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} style={({ pressed }) => [s.link, pressed && pressedStyle]}>
      <Text style={s.linkText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    cardTitle: { ...f(600, 19, 25), color: c.ink },
    links: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    link: { minHeight: minTarget, minWidth: minTarget, justifyContent: "center" },
    linkText: { ...f(600, 15), color: c.ink, textDecorationLine: "underline" },
    otherRow: { gap: 2, paddingVertical: space(1), borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth },
    otherSlot: { ...f(600, 13, 18), color: c.ink2 },
    otherTitle: { ...f(500, 16, 22), color: c.ink },
  });
