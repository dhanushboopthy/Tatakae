import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useRecharge } from "../src/lib/hooks";
import { PillButton, MiniBar } from "../src/components/fitnessUi";
import { BigButton } from "../src/components/BigButton";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { tapTimerEnd } from "../src/haptics";
import { f, space } from "../src/theme";
import { useStyles, useTheme, type Theme } from "../src/lib/theme";

const BREAK_MS = 5 * 60_000;

/**
 * After a focus block: pick one recharge (walk / music / call / stretch / sketch, from recharge_items),
 * then a calm 5-minute timer on this screen only (a quiet haptic at zero, no notification).
 */
export default function Recharge() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const { data: items = [] } = useRecharge();
  const [picked, setPicked] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const left = startedAt == null ? BREAK_MS : Math.max(0, BREAK_MS - (now - startedAt));
  const over = startedAt != null && left === 0;

  useEffect(() => {
    if (over) tapTimerEnd();
  }, [over]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);

  return (
    <Screen sheet>
      <SheetHeader title="Recharge" subtitle="Pick one. Five minutes, away from the screen." onClose={close} />
      {picked == null ? (
        <Card tone="surface">
          <View style={s.wrap}>
            {items.map((r) => (
              <PillButton
                key={r.id}
                label={r.name}
                tone="lavender"
                onPress={() => {
                  setPicked(r.name);
                  setStartedAt(Date.now());
                  setNow(Date.now());
                }}
              />
            ))}
          </View>
          <BigButton label="Skip" variant="quiet" onPress={close} />
        </Card>
      ) : (
        <Card tone="surface">
          <Text style={s.title}>{picked}</Text>
          <Text style={s.clock} accessibilityLabel={over ? "Break over" : `${mm} minutes ${ss} seconds left`}>
            {over ? "Done" : `${mm}:${String(ss).padStart(2, "0")}`}
          </Text>
          <MiniBar pct={((BREAK_MS - left) / BREAK_MS) * 100} color={c.lavenderDeep} label="Break" />
          <Text style={s.small}>{over ? "Come back when you're ready." : "No need to watch this. It buzzes once at zero."}</Text>
          <BigButton label="I'm back" onPress={close} size="large" />
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    title: { ...f(600, 18, 24), color: c.ink },
    clock: { ...f(600, 56, 62), color: c.ink, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
    small: { ...f(500, 13, 18), color: c.ink2 },
  });
