import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { login, LoginError, type LoginProblem } from "../src/auth/session";
import { requestPermission } from "../src/notifications/local";
import { BigButton } from "../src/components/BigButton";
import { TextField } from "../src/components/TextField";
import { Card, Screen } from "../src/components/Screen";
import { f, space } from "../src/theme";
import { useStyles, type Theme } from "../src/lib/theme";

const PROBLEM_COPY: Record<LoginProblem, string> = {
  credentials: "That email and password didn't match. Try again.",
  rate_limited: "Too many tries for now. Wait a few minutes, then try again.",
  offline: "You're offline or the server can't be reached. Try again when you're connected.",
  server: "The server didn't answer properly. Try again in a moment.",
};

/** Email + password + device name → POST /api/session/login { client: "mobile" } → token in SecureStore. */
export default function Login() {
  const s = useStyles(makeStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const deviceRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setProblem(null);
    try {
      await login(email, password, deviceName);
      setPassword("");
      router.replace("/");
      // Reminders: asked once, after the first sign-in (never on launch).
      void requestPermission();
    } catch (e) {
      setProblem(e instanceof LoginError ? PROBLEM_COPY[e.problem] : PROBLEM_COPY.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={s.content}>
      <View style={s.header}>
        <View style={s.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[s.step, s.step1]} />
          <View style={[s.step, s.step2]} />
          <View style={[s.step, s.step3]} />
        </View>
        <Text style={s.title} accessibilityRole="header">
          Tatakae
        </Text>
        <Text style={s.line}>Sign in once on this phone. Everything works offline after that.</Text>
      </View>

      <Card>
        <TextField
          tone="surface"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          tone="surface"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => deviceRef.current?.focus()}
        />
        <TextField
          ref={deviceRef}
          tone="surface"
          label="Device name"
          hint="Shown in the devices list so you can sign this phone out later."
          value={deviceName}
          onChangeText={setDeviceName}
          maxLength={40}
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
      </Card>

      {problem ? (
        <Text style={s.problem} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}

      <BigButton label="Sign in" onPress={() => void submit()} disabled={!canSubmit} busy={busy} size="large" />
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    content: { flexGrow: 1, justifyContent: "center" },
    header: { gap: space(1), marginBottom: space(1) },
    // The app mark: three rising steps, grey → lavender → lime (docs/11 §6).
    mark: { flexDirection: "row", alignItems: "flex-end", gap: 4, width: 56, height: 56, padding: 10, borderRadius: 16, backgroundColor: c.hero, marginBottom: space(1) },
    step: { flex: 1, borderRadius: 4 },
    step1: { height: 14, backgroundColor: c.missed },
    step2: { height: 24, backgroundColor: c.lavender },
    step3: { height: 34, backgroundColor: c.lime },
    title: { ...f(600, 30, 36), color: c.ink, letterSpacing: -0.6 },
    line: { ...f(500, 15, 22), color: c.ink2 },
    problem: { ...f(500, 16, 24), color: c.ink },
  });
