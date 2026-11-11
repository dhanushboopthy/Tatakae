import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { planP1, setDayFlag, startFocus, useDay, useRecentDays, useToday, writeOff, writeOffsLeft } from "../src/lib/hooks";
import { longDate, weekdayInitial } from "../src/lib/format";
import { P1HeroCard } from "../src/components/P1HeroCard";
import { P1QuickForm } from "../src/components/P1QuickForm";
import { BigButton } from "../src/components/BigButton";
import { TextField } from "../src/components/TextField";
import { Kural } from "../src/components/Kural";
import { Card, Screen, ScreenHeader } from "../src/components/Screen";
import { tapDone } from "../src/haptics";
import { f, space } from "../src/theme";
import { useStyles, type Theme } from "../src/lib/theme";

type Mode = "choose" | "restart" | "writeoff";

/**
 * Welcome back (docs/02 lapse protocol, docs/05): calm line, grey history (no red, no count), Restart
 * plans only P1 for today, or write today off (max 2 a month, with a reason). Shown once per day.
 */
export default function WelcomeBack() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const { data: view } = useDay(today);
  const { data: history = [] } = useRecentDays(7);
  const [mode, setMode] = useState<Mode>("choose");
  const [left, setLeft] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void setDayFlag(today, "welcomed");
  }, [today]);

  useEffect(() => {
    if (view) void writeOffsLeft(today, view.settings).then(setLeft);
  }, [view, today]);

  const goToday = () => router.dismissTo("/");
  const p1 = view?.p1 ?? null;
  const canWriteOff = left != null && left > 0 && view?.day?.kind !== "write_off";

  async function confirmWriteOff() {
    if (!view || reason.trim().length < 3) return;
    const r = await writeOff(today, reason, view.settings);
    if (!r.ok) {
      setProblem("Both write-offs for this month are used. Restart with one mission instead.");
      return;
    }
    tapDone();
    goToday();
  }

  return (
    <Screen>
      <ScreenHeader eyebrow={longDate(today)} title="Welcome back." />
      <Text style={s.lead}>One mission today — that's the whole plan.</Text>

      <Kural n={621} />

      <View>
        <View style={s.history} accessibilityLabel="Last seven days">
          {history.map((h) => {
            const before = !h.missed && h.score == null;
            const rest = h.kind !== "normal";
            const label = before ? "nothing yet" : rest ? "rest" : h.missed ? "grey" : "shown up";
            return (
              <View key={h.date} style={s.day}>
                <View
                  style={[s.dot, before ? s.dotBefore : rest ? s.dotRest : h.missed ? s.dotMissed : s.dotShown]}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`${longDate(h.date)}: ${label}`}
                />
                <Text style={s.letter} accessibilityElementsHidden importantForAccessibility="no">
                  {weekdayInitial(h.date)}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={s.small}>Misses turn grey. Nothing resets. Don't miss twice.</Text>
      </View>

      {mode === "choose" ? (
        <View style={s.actions}>
          <BigButton label="Restart with one mission" variant="accent" size="large" onPress={() => setMode("restart")} />
          {canWriteOff ? <BigButton label="Write today off" variant="secondary" onPress={() => setMode("writeoff")} /> : null}
          <BigButton label="Just go to Today" variant="quiet" onPress={goToday} />
        </View>
      ) : null}

      {mode === "restart" && view ? (
        p1 ? (
          <>
            <P1HeroCard
              mission={p1}
              onStart={async () => {
                await startFocus(p1.id, view.settings.focus_default);
                router.dismissTo("/focus");
              }}
            />
            <Text style={s.small}>Your P1 is already planned. Start it, or do the Minimum and it counts.</Text>
            <BigButton label="Go to Today" variant="secondary" onPress={goToday} />
          </>
        ) : (
          <Card>
            <P1QuickForm
              tone="surface"
              submitLabel="Restart"
              onSubmit={async (fields) => {
                await planP1(today, fields, view.forged ? { lockReason: "Restarted after a missed day" } : undefined);
                tapDone();
                goToday();
              }}
            />
            <BigButton label="Back" variant="quiet" onPress={() => setMode("choose")} />
          </Card>
        )
      ) : null}

      {mode === "writeoff" && left != null ? (
        <Card>
          <TextField
            tone="surface"
            label="Why today? (a few words)"
            value={reason}
            onChangeText={setReason}
            maxLength={200}
            autoFocus
            hint={`${left} of ${view?.settings.scoring.writeOffsPerMonth ?? 2} write-offs left this month. It won't count either way.`}
          />
          {problem ? (
            <Text style={s.body} accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
          <View style={s.row}>
            <BigButton label="Back" variant="secondary" onPress={() => setMode("choose")} style={s.flex} />
            <BigButton label="Write off" onPress={() => void confirmWriteOff()} disabled={reason.trim().length < 3} style={s.flex} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    lead: { ...f(500, 18, 26), color: c.ink },
    body: { ...f(400, 16, 24), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2, marginTop: space(1) },
    history: { flexDirection: "row", justifyContent: "space-between" },
    day: { alignItems: "center", gap: 6 },
    dot: { width: 40, height: 40, borderRadius: 20 },
    dotBefore: { borderWidth: 2, borderColor: c.line },
    dotRest: { borderWidth: 2, borderColor: c.missed },
    dotMissed: { backgroundColor: c.surface2 },
    dotShown: { backgroundColor: c.lime },
    letter: { ...f(600, 12, 16), color: c.ink2 },
    actions: { gap: space(1) },
    row: { flexDirection: "row", gap: space(1) },
    flex: { flex: 1 },
  });
