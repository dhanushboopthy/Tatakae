import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Mission } from "@tatakae/core";
import type { MissionEdit } from "../lib/hooks";
import { radius, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { BigButton } from "./BigButton";
import { SheetHeader } from "./Screen";
import { TextField } from "./TextField";

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
  const s = useStyles(makeStyles);
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
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <SheetHeader title="Edit mission" onClose={onClose} closeLabel="Cancel" />
            {locked ? <Text style={s.note}>The plan is locked. You can still change it — say why in a few words.</Text> : null}

            <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
            <TextField label="Minimum version" value={minimum} onChangeText={setMinimum} maxLength={200} />
            <TextField label="If-then plan" value={ifThen} onChangeText={setIfThen} maxLength={300} multiline />
            {locked ? (
              <TextField label="Reason for the change" value={reason} onChangeText={setReason} maxLength={300} placeholder="e.g. Meeting moved into the morning" />
            ) : null}

            <View style={s.actions}>
              <BigButton label="Cancel" variant="secondary" onPress={onClose} style={s.flex} />
              <BigButton label="Save" onPress={() => void save()} disabled={!canSave} busy={busy} style={s.flex} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ c, t }: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, maxHeight: "90%" },
    content: { padding: space(2.5), gap: space(2), paddingBottom: space(4) },
    note: { ...t.secondary },
    actions: { flexDirection: "row", gap: space(1) },
    flex: { flex: 1 },
  });
