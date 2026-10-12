import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { login, LoginError, type LoginProblem } from "../src/auth/session";
import { BigButton } from "../src/components/BigButton";
import { colors, space, text, ui } from "../src/theme";

const PROBLEM_COPY: Record<LoginProblem, string> = {
  credentials: "That email and password didn't match. Try again.",
  rate_limited: "Too many tries for now. Wait a few minutes, then try again.",
  offline: "You're offline or the server can't be reached. Try again when you're connected.",
  server: "The server didn't answer properly. Try again in a moment.",
};

/** Email + password + device name → POST /api/session/login { client: "mobile" } → token in SecureStore. */
export default function Login() {
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
    } catch (e) {
      setProblem(e instanceof LoginError ? PROBLEM_COPY[e.problem] : PROBLEM_COPY.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={text.h1} accessibilityRole="header">
              Tatakae
            </Text>
            <Text style={text.small}>Sign in once on this phone. Everything works offline after that.</Text>
          </View>

          <View style={styles.field}>
            <Text style={text.label} nativeID="emailLabel">
              Email
            </Text>
            <TextInput
              style={ui.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabelledBy="emailLabel"
              accessibilityLabel="Email"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={text.label} nativeID="passwordLabel">
              Password
            </Text>
            <TextInput
              ref={passwordRef}
              style={ui.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="next"
              onSubmitEditing={() => deviceRef.current?.focus()}
              accessibilityLabelledBy="passwordLabel"
              accessibilityLabel="Password"
            />
          </View>

          <View style={styles.field}>
            <Text style={text.label} nativeID="deviceLabel">
              Device name
            </Text>
            <TextInput
              ref={deviceRef}
              style={ui.input}
              value={deviceName}
              onChangeText={setDeviceName}
              maxLength={40}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              accessibilityLabelledBy="deviceLabel"
              accessibilityLabel="Device name"
              accessibilityHint="Shown in the devices list so you can revoke this phone later"
            />
          </View>

          {problem ? (
            <Text style={styles.problem} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}

          <BigButton label="Sign in" onPress={() => void submit()} disabled={!canSubmit} busy={busy} size="large" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: space(3), gap: space(2) },
  header: { gap: space(1), marginBottom: space(2) },
  field: { gap: space(0.5) },
  problem: { color: colors.paper, fontSize: 16, lineHeight: 24 },
});
