import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { confirmPassword, type ReauthOutcome } from "../api/client";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { BigButton } from "./BigButton";
import { TextField } from "./TextField";

const PROBLEM: Record<Exclude<ReauthOutcome, "ok">, string> = {
  wrong: "That password didn't match. Try again.",
  rate_limited: "Too many tries. Wait a few minutes, then try again.",
  offline: "This needs a connection. Try again when you're online.",
  server: "Couldn't check it right now. Try again in a moment.",
};

/**
 * "Confirm it's you" inline on the phone (security S8): shown when an action answered 403
 * reauth_required. On success it calls `onConfirmed` (which retries the action); a wrong password
 * never signs the phone out.
 */
export function ReauthPrompt({ action, onConfirmed, onCancel }: { action: string; onConfirmed: () => void; onCancel: () => void }) {
  const s = useStyles(makeStyles);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function confirm() {
    if (!password || busy) return;
    setBusy(true);
    setProblem(null);
    const outcome = await confirmPassword(password);
    setBusy(false);
    if (outcome === "ok") {
      setPassword("");
      onConfirmed();
    } else {
      setProblem(PROBLEM[outcome]);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title} accessibilityRole="header">
        Confirm it's you
      </Text>
      <Text style={s.note}>{action} needs your password. It stays confirmed for 10 minutes.</Text>
      <TextField
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        autoFocus
        maxLength={256}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void confirm()}
        returnKeyType="done"
      />
      {problem ? (
        <Text style={s.note} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      <BigButton label="Confirm" variant="accent" busy={busy} disabled={!password} onPress={() => void confirm()} />
      <BigButton label="Not now" variant="quiet" onPress={onCancel} />
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1.25), paddingVertical: space(1) },
    title: { ...f(600, 15, 22), color: c.ink },
    note: { ...f(500, 13, 18), color: c.ink2 },
  });
