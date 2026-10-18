import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { conflictLabel, conflictMessage, type SyncTable } from "@tatakae/core";
import { onConflictBatch, useConflictNote } from "../sync/conflicts";
import { f, space } from "../theme";
import { Icon } from "./Icon";
import { Toast } from "./Toast";

/** Mounted once in the root layout: one calm toast per sync round that had conflicts. */
export function ConflictNoticeHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState(0);
  useEffect(
    () =>
      onConflictBatch((batch) => {
        const m = conflictMessage(batch);
        if (!m) return;
        setMsg(m);
        setToken((n) => n + 1);
      }),
    [],
  );
  return (
    <View style={[styles.host, { top: insets.top + space(1) }]} pointerEvents="none">
      <Toast message={msg} token={token} kind="info" durationMs={6_000} />
    </View>
  );
}

/** Small line on a card whose row was just replaced by another device's version. */
export function EditedElsewhere({ table, pk, color }: { table: SyncTable; pk: string; color: string }) {
  const note = useConflictNote(table, pk);
  if (!note) return null;
  const label = conflictLabel(note.kind);
  return (
    <View style={styles.pill} accessibilityLabel={label}>
      <Icon name="info" size={14} color={color} strokeWidth={2} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: space(2), right: space(2), alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { ...f(600, 13, 18) },
});
