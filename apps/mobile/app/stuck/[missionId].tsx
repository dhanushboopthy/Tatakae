import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Blocker } from "@tatakae/core";
import { logStuck, startFocus, useFocusSession, useMission } from "../../src/lib/hooks";
import { StuckSheet } from "../../src/components/StuckSheet";
import { Kural } from "../../src/components/Kural";
import { BigButton } from "../../src/components/BigButton";
import { TextField } from "../../src/components/TextField";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { tapDone } from "../../src/haptics";
import { f, space } from "../../src/theme";
import { useStyles, type Theme } from "../../src/lib/theme";

/**
 * Stuck (docs/05: ≤ 15 s): three big choices → one follow-up. Uncertainty → the next physical action;
 * Fear → 10 / 10 / 10 and "if you were confident"; Inertia → a 5-minute focus block right now.
 * Each writes a stuck_events row (Sunday's stuck breakdown). No lecture.
 */
export default function Stuck() {
  const s = useStyles(makeStyles);
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  const { data: mission } = useMission(missionId);
  const { data: session } = useFocusSession();
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(b: Blocker) {
    if (!missionId) return;
    if (b !== "inertia") {
      setBlocker(b);
      return;
    }
    await logStuck(missionId, "inertia", "5-minute timer");
    tapDone();
    // A block already running keeps going; otherwise start five minutes now.
    if (!session) await startFocus(missionId, 5);
    router.dismissTo("/focus");
  }

  async function save() {
    if (!missionId || !blocker || busy) return;
    setBusy(true);
    try {
      await logStuck(missionId, blocker, text);
      tapDone();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen sheet>
      <SheetHeader title="Stuck?" subtitle={mission?.title} onClose={() => router.back()} />
      {!blocker ? (
        <>
          <StuckSheet onPick={(b) => void pick(b)} />
          <View style={s.kural}>
            <Kural n={611} />
          </View>
        </>
      ) : (
        <Card tone="surface">
          {blocker === "fear" ? (
            <View style={s.list}>
              <Text style={s.item}>How much will this matter in 10 minutes?</Text>
              <Text style={s.item}>In 10 months?</Text>
              <Text style={s.item}>In 10 years?</Text>
            </View>
          ) : null}
          <TextField
            label={blocker === "uncertainty" ? "What's the next physical action?" : "If you were confident, what would you do first?"}
            value={text}
            onChangeText={setText}
            autoFocus
            maxLength={300}
            placeholder={blocker === "uncertainty" ? "e.g. Open the Terraform docs on modules" : "e.g. Send the draft as it is"}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />
          <View style={s.row}>
            <BigButton label="Back" variant="secondary" onPress={() => setBlocker(null)} style={s.flex} />
            <BigButton label="Save and go" onPress={() => void save()} busy={busy} style={s.flex} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    kural: { marginTop: space(1) },
    list: { gap: 4, backgroundColor: c.surface2, borderRadius: 16, padding: space(2) },
    item: { ...f(500, 15, 22), color: c.ink },
    row: { flexDirection: "row", gap: space(1) },
    flex: { flex: 1 },
  });
