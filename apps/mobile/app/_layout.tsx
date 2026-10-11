import "react-native-get-random-values"; // must load before ulid (packages/core)
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

/** Root: providers, auth gate (no session → /login), sync engine init, dark theme. */
export default function RootLayout() {
  // TODO(phase0): auth gate via src/auth/session.ts
  // TODO(v1): initSync(queryClient); scheduleLocalNotifications()
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
