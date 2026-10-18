import "react-native-get-random-values"; // crypto.getRandomValues before any id is generated
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { getToken, onAuthChange, setExpiresAt, type AuthState } from "../src/auth/session";
import { apiGet, ApiError } from "../src/api/client";
import { initSync } from "../src/sync/engine"; // also defines the background sync task at module scope
import { initNotifications } from "../src/notifications/local";
import { clearQuickActions, registerQuickActions } from "../src/native/quickActions";
import { ShareIntentProvider } from "expo-share-intent";
import { useShareToCapture } from "../src/native/shareIntent";
import { initWidget } from "../src/native/widget";
import { useSettings } from "../src/lib/hooks";
import { ThemeProvider, useReducedMotion, useTheme } from "../src/lib/theme";
import { setHapticsEnabled } from "../src/haptics";

/** Deep links (notification taps) into a modal still get the tabs underneath. */
export const unstable_settings = { initialRouteName: "(tabs)" };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false, networkMode: "always" } },
});

/** Root: providers, fonts, theme (light by day, dark at night), auth gate (no token → /login). */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  return (
    <ShareIntentProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Themed ready={fontsLoaded || fontError != null} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

/** Navigation theme and status bar follow the app theme. */
function Themed({ ready }: { ready: boolean }) {
  const { dark, c } = useTheme();
  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c.surface, card: c.surface, border: c.line, text: c.ink, primary: c.ink } };
  }, [dark, c]);
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <AuthGate ready={ready} />
    </NavThemeProvider>
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

function AuthGate({ ready }: { ready: boolean }) {
  const { c } = useTheme();
  const reducedMotion = useReducedMotion();
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
    const stopSync = initSync(queryClient);
    const stopReminders = initNotifications();
    void registerQuickActions();
    const stopWidget = initWidget();
    return () => {
      stopWidget();
      stopReminders();
      stopSync();
      void clearQuickActions();
    };
  }, [auth]);

  useShareToCapture(auth === "in" && ready);

  const settings = useSettings();
  useEffect(() => {
    if (settings.data) setHapticsEnabled(settings.data.haptics_enabled);
  }, [settings.data]);

  return (
    <View style={[styles.fill, { backgroundColor: c.surface }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.surface }, animation: reducedMotion ? "none" : "fade" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="morning" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="welcome-back" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="quick-close" options={{ presentation: "modal" }} />
        <Stack.Screen name="stuck/[missionId]" options={{ presentation: "modal" }} />
        <Stack.Screen name="recharge" options={{ presentation: "modal" }} />
        <Stack.Screen name="capture" options={{ presentation: "modal" }} />
        <Stack.Screen name="fitness/body" options={{ presentation: "modal" }} />
        <Stack.Screen name="fitness/food" options={{ presentation: "modal" }} />
        <Stack.Screen name="fitness/set" options={{ presentation: "modal" }} />
        <Stack.Screen name="day/[date]" />
        <Stack.Screen name="cycle" options={{ presentation: "modal" }} />
        <Stack.Screen name="notes/index" options={{ presentation: "modal" }} />
        <Stack.Screen name="notes/[id]" />
        <Stack.Screen name="dev/design" options={{ presentation: "modal" }} />
      </Stack>
      {auth === "loading" || !ready ? <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
