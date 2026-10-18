import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { P1Fields } from "../lib/hooks";
import { space } from "../theme";
import { useTheme } from "../lib/theme";
import { BigButton } from "./BigButton";
import { TextField } from "./TextField";

export interface P1QuickFormProps {
  /** Button label, e.g. "Plan P1" or "Restart with this". */
  submitLabel: string;
  onSubmit: (f: P1Fields) => Promise<void>;
  /** Shown above the fields. */
  intro?: string;
  tone?: "surface" | "surface2";
}

/**
 * Plan only P1: title + Minimum + if-then. Minimum and if-then are what make a P1 (docs/02);
 * the form asks for them but keeps the copy short.
 */
export function P1QuickForm({ submitLabel, onSubmit, intro, tone }: P1QuickFormProps) {
  const { t } = useTheme();
  const [title, setTitle] = useState("");
  const [minimum, setMinimum] = useState("");
  const [ifThen, setIfThen] = useState("");
  const [busy, setBusy] = useState(false);
  const minRef = useRef<TextInput>(null);
  const ifRef = useRef<TextInput>(null);

  const ok = title.trim() !== "" && minimum.trim() !== "" && ifThen.trim() !== "" && !busy;

  async function submit() {
    if (!ok) return;
    setBusy(true);
    try {
      await onSubmit({ title, minimum, ifThen });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {intro ? <Text style={t.body}>{intro}</Text> : null}
      <TextField
        tone={tone}
        label="P1 — the one mission that makes today count"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        placeholder="e.g. Terraform module for the VCN"
        returnKeyType="next"
        onSubmitEditing={() => minRef.current?.focus()}
        accessibilityLabel="P1 title"
      />
      <TextField
        ref={minRef}
        tone={tone}
        label="Minimum version (counts as half)"
        value={minimum}
        onChangeText={setMinimum}
        maxLength={200}
        placeholder="e.g. Write the variables file"
        returnKeyType="next"
        onSubmitEditing={() => ifRef.current?.focus()}
        accessibilityLabel="Minimum version"
      />
      <TextField
        ref={ifRef}
        tone={tone}
        label="If-then plan"
        value={ifThen}
        onChangeText={setIfThen}
        maxLength={300}
        placeholder="If it's 9:00, then I open the repo at my desk"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        accessibilityLabel="If-then plan"
      />
      <BigButton label={submitLabel} onPress={() => void submit()} disabled={!ok} busy={busy} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space(2) },
});
