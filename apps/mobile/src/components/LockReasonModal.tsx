import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Mission } from "@tatakae/core";
import type { MissionEdit } from "../lib/hooks";
import { colors, radius, space, text, ui } from "../theme";
import { BigButton } from "./BigButton";

export interface LockReasonModalProps {
  mission: Mission | null;
  /** The day is forged: changing title / Minimum / if-then needs a short reason (→ mura event). */
  locked: boolean;
  onClose: () => void;
  onSave: (patch: MissionEdit, reason: string | null) => Promise<void>;
}

/**
 * Edit a mission. On a locked plan this is a soft lock: you can still change it, but you type
 * why, and the reason shows up in Sunday's Mura review. No hard locks.
 */
export function LockReasonModal({ mission, locked, onClose, onSave }: LockReasonModalProps) {
  const [title, setTitle] = useState("");
  const [minimum, setMinimum] = useState("");
  const [ifThen, setIfThen] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(mission?.title ?? "");
    setMinimum(mission?.minimum ?? "");
    setIfThen(mission?.ifThen ?? "");
    setReason("");
  }, [mission]);

  if (!mission) return null;

  const patch: MissionEdit = {
    title: title.trim(),
    minimum: minimum.trim() || null,
    ifThen: ifThen.trim() || null,
  };
  const changed = patch.title !== mission.title || patch.minimum !== mission.minimum || patch.ifThen !== mission.ifThen;
  const reasonOk = !locked || reason.trim().length >= 3;
  const canSave = changed && patch.title !== "" && reasonOk && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave(patch, locked ? reason.trim() : null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={text.h2} accessibilityRole="header">
              Edit mission
            </Text>
            {locked ? <Text style={text.small}>The plan is locked. You can still change it — say why in a few words.</Text> : null}

            <Field label="Title" value={title} onChange={setTitle} max={200} />
            <Field label="Minimum version" value={minimum} onChange={setMinimum} max={200} />
            <Field label="If-then plan" value={ifThen} onChange={setIfThen} max={300} multiline />
            {locked ? (
              <Field
                label="Reason for the change"
                value={reason}
                onChange={setReason}
                max={300}
                placeholder="e.g. Meeting moved into the morning"
              />
            ) : null}

            <View style={styles.actions}>
              <BigButton label="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
              <BigButton label="Save" onPress={() => void save()} disabled={!canSave} busy={busy} style={styles.flex} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={text.label}>{props.label}</Text>
      <TextInput
        style={[ui.input, props.multiline && styles.multiline]}
        value={props.value}
        onChangeText={props.onChange}
        maxLength={props.max}
        multiline={props.multiline}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={props.label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderColor: colors.line,
    borderWidth: 1,
    maxHeight: "90%",
  },
  content: { padding: space(2), gap: space(2), paddingBottom: space(4) },
  field: { gap: 4 },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: space(1) },
  flex: { flex: 1 },
});
