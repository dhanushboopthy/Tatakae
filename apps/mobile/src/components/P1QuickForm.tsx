import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { P1Fields } from "../lib/hooks";
import { colors, space, text, ui } from "../theme";
import { BigButton } from "./BigButton";

export interface P1QuickFormProps {
  /** Button label, e.g. "Plan P1" or "Restart with this". */
  submitLabel: string;
  onSubmit: (f: P1Fields) => Promise<void>;
  /** Shown above the fields. */
  intro?: string;
}

/**
 * Plan only P1: title + Minimum + if-then. Minimum and if-then are what make a P1 (docs/02);
 * the form asks for them but keeps the copy short.
 */
export function P1QuickForm({ submitLabel, onSubmit, intro }: P1QuickFormProps) {
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
      {intro ? <Text style={text.body}>{intro}</Text> : null}
      <View style={styles.field}>
        <Text style={text.label}>P1 — the one mission that makes today count</Text>
        <TextInput
          style={ui.input}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          placeholder="e.g. Terraform module for the VCN"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          onSubmitEditing={() => minRef.current?.focus()}
          accessibilityLabel="P1 title"
        />
      </View>
      <View style={styles.field}>
        <Text style={text.label}>Minimum version (counts as half)</Text>
        <TextInput
          ref={minRef}
          style={ui.input}
          value={minimum}
          onChangeText={setMinimum}
          maxLength={200}
          placeholder="e.g. Write the variables file"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          onSubmitEditing={() => ifRef.current?.focus()}
          accessibilityLabel="Minimum version"
        />
      </View>
      <View style={styles.field}>
        <Text style={text.label}>If-then plan</Text>
        <TextInput
          ref={ifRef}
          style={ui.input}
          value={ifThen}
          onChangeText={setIfThen}
          maxLength={300}
          placeholder="If it's 9:00, then I open the repo at my desk"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          accessibilityLabel="If-then plan"
        />
      </View>
      <BigButton label={submitLabel} onPress={() => void submit()} disabled={!ok} busy={busy} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space(2) },
  field: { gap: 4 },
});
