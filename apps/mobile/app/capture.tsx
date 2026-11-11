import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { capture, useInbox } from "../src/lib/hooks";
import { BigButton } from "../src/components/BigButton";
import { Toast } from "../src/components/Toast";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { tapDone } from "../src/haptics";
import { f, space } from "../src/theme";
import { useStyles, useTheme, type Theme } from "../src/lib/theme";

/**
 * Capture (docs/05: ≤ 5 s): one autofocused field, Save → outbox → inbox, haptic + "Saved", then
 * close. No categories, nothing required but the words. Opened from the "+" in every header, and
 * from the share sheet / launcher shortcut with `?text=` prefilled.
 */
export default function Capture() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const params = useLocalSearchParams<{ text?: string }>();
  const inbox = useInbox();
  const [value, setValue] = useState(() => (typeof params.text === "string" ? params.text : ""));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(0);
  const input = useRef<TextInput>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closing.current) clearTimeout(closing.current);
  }, []);

  // A second share while the sheet is open replaces the empty field (never what you typed).
  useEffect(() => {
    if (typeof params.text === "string" && params.text !== "") setValue((v) => (v.trim() === "" ? params.text ?? "" : v));
  }, [params.text]);

  async function save() {
    if (busy || value.trim() === "") return;
    setBusy(true);
    try {
      const item = await capture(value);
      if (!item) return;
      tapDone();
      setValue("");
      setToast((n) => n + 1);
      closing.current = setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }, 700);
    } finally {
      setBusy(false);
    }
  }

  const waiting = inbox.data?.length ?? 0;

  return (
    <Screen sheet>
      <SheetHeader title="Capture" subtitle="It goes to the inbox. No sorting now." onClose={() => router.back()} />
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
      <Text style={s.note}>
        {waiting === 0 ? "The inbox is empty." : `${waiting} ${waiting === 1 ? "item" : "items"} in the inbox. You sort them on the laptop.`}
      </Text>
      <View style={s.toast} pointerEvents="none">
        <Toast message="Saved to the inbox" token={toast} />
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
