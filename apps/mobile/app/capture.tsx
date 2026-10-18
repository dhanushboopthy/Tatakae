import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { capture, useInbox } from "../src/lib/hooks";
import { isOffline, saveAsNote } from "../src/lib/notes";
import { BigButton } from "../src/components/BigButton";
import { IconCircle } from "../src/components/IconCircle";
import { Toast } from "../src/components/Toast";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { tapDone } from "../src/haptics";
import { f, space } from "../src/theme";
import { useStyles, useTheme, type Theme } from "../src/lib/theme";

/**
 * Capture (docs/05: ≤ 5 s): one autofocused field, Save → outbox → inbox, haptic + "Saved", then
 * close. No categories, nothing required but the words. Opened from the "+" in every header, and
 * from the share sheet / launcher shortcut with `?text=` prefilled. "Save as a note" posts straight
 * to /notes (first line = title); notes aren't synced, so that one needs a connection.
 */
export default function Capture() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const params = useLocalSearchParams<{ text?: string }>();
  const inbox = useInbox();
  const [value, setValue] = useState(() => (typeof params.text === "string" ? params.text : ""));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(0);
  const [toastMsg, setToastMsg] = useState("Saved to the inbox");
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const qc = useQueryClient();
  const input = useRef<TextInput>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closing.current) clearTimeout(closing.current);
  }, []);

  // A second share while the sheet is open replaces the empty field (never what you typed).
  useEffect(() => {
    if (typeof params.text === "string" && params.text !== "") setValue((v) => (v.trim() === "" ? params.text ?? "" : v));
  }, [params.text]);

  function saved(message: string) {
    tapDone();
    setValue("");
    setNoteMsg(null);
    setToastMsg(message);
    setToast((n) => n + 1);
    closing.current = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }, 700);
  }

  async function save() {
    if (busy || value.trim() === "") return;
    setBusy(true);
    try {
      const item = await capture(value);
      if (!item) return;
      saved("Saved to the inbox");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (busy || value.trim() === "") return;
    setBusy(true);
    setNoteMsg(null);
    try {
      const note = await saveAsNote(value);
      if (!note) return;
      void qc.invalidateQueries({ queryKey: ["notes"] });
      saved("Saved as a note");
    } catch (e) {
      setNoteMsg(
        isOffline(e)
          ? "Notes need a connection. Your words are still here: save them to the inbox, or try again later."
          : "The note didn't save. Your words are still here.",
      );
    } finally {
      setBusy(false);
    }
  }

  const waiting = inbox.data?.length ?? 0;

  return (
    <Screen sheet>
      <SheetHeader
        title="Capture"
        subtitle="It goes to the inbox. No sorting now."
        onClose={() => router.back()}
        right={<IconCircle icon="notes" variant="soft" onPress={() => router.push("/notes")} accessibilityLabel="Notes" accessibilityHint="Search and read your notes" />}
      />
      <Card tone="surface">
        <TextInput
          ref={input}
          value={value}
          onChangeText={setValue}
          autoFocus
          multiline
          maxLength={1000}
          placeholder="What's on your mind?"
          placeholderTextColor={c.ink2}
          accessibilityLabel="What's on your mind?"
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void save()}
          style={s.input}
        />
      </Card>
      <BigButton label="Save" onPress={() => void save()} disabled={value.trim() === ""} busy={busy} size="large" />
      <BigButton
        label="Save as a note"
        variant="quiet"
        size="compact"
        onPress={() => void saveNote()}
        disabled={value.trim() === "" || busy}
        accessibilityHint="The first line becomes the title. Needs a connection."
      />
      {noteMsg ? (
        <Text style={s.note} accessibilityLiveRegion="polite">
          {noteMsg}
        </Text>
      ) : null}
      <Text style={s.note}>
        {waiting === 0 ? "The inbox is empty." : `${waiting} ${waiting === 1 ? "item" : "items"} in the inbox. You sort them on the laptop.`}
      </Text>
      <View style={s.toast} pointerEvents="none">
        <Toast message={toastMsg} token={toast} />
      </View>
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    input: { ...f(500, 18, 26), color: c.ink, minHeight: 120, textAlignVertical: "top", padding: 0 },
    note: { ...f(500, 14, 20), color: c.ink2, textAlign: "center" },
    toast: { alignItems: "center", marginTop: space(1) },
  });
