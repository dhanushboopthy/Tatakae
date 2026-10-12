import "react-native-get-random-values"; // crypto.getRandomValues before any id is generated
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments, ThemeProvider, DarkTheme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { getToken, onAuthChange, setExpiresAt, type AuthState } from "../src/auth/session";
import { apiGet, ApiError } from "../src/api/client";
import { colors } from "../src/theme";

/** Deep links (notification taps) into a modal still get the tabs underneath. */
export const unstable_settings = { initialRouteName: "(tabs)" };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false, networkMode: "always" } },
});

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.ink2, border: colors.line, text: colors.paper, primary: colors.ember },
};

/** Root: providers, auth gate (no token → /login), dark theme. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <AuthGate />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function useAuthState(): AuthState | "loading" {
  const [state, setState] = useState<AuthState | "loading">("loading");
  useEffect(() => {
    let alive = true;
    void getToken().then((t) => {
      if (alive) setState(t ? "in" : "out");
    });
    const off = onAuthChange((s) => setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

/** GET /session/me once per launch when online. A 401 clears the token (api/client); offline is fine. */
async function verifySession(): Promise<void> {
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return;
  try {
    const me = await apiGet<unknown>("/session/me");
    if (typeof me === "object" && me !== null && "expiresAt" in me) {
      const exp = (me as { expiresAt: unknown }).expiresAt;
      if (typeof exp === "string") await setExpiresAt(exp);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return; // already redirected
    // Offline or server trouble: keep working from the local store.
  }
}

function AuthGate() {
  const auth = useAuthState();
  const segments = useSegments();
  const router = useRouter();
  const onLogin = segments[0] === "login";

  useEffect(() => {
    if (auth === "loading") return;
    if (auth === "out" && !onLogin) router.replace("/login");
    else if (auth === "in" && onLogin) router.replace("/");
  }, [auth, onLogin, router]);

  useEffect(() => {
    if (auth !== "in") return;
    void verifySession();
  }, [auth]);

  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: "fade" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="morning" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="welcome-back" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="quick-close" options={{ presentation: "modal" }} />
        <Stack.Screen name="stuck/[missionId]" options={{ presentation: "modal" }} />
        <Stack.Screen name="recharge" options={{ presentation: "modal" }} />
      </Stack>
      {auth === "loading" ? <View style={[StyleSheet.absoluteFill, styles.cover]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.ink },
  cover: { backgroundColor: colors.ink },
});
