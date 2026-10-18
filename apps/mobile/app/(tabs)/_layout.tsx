import { Tabs } from "expo-router";
import { BottomNav } from "../../src/components/BottomNav";
import { useTheme } from "../../src/lib/theme";

/**
 * Tabs: Today · Calendar · Focus · Settings in the floating charcoal pill nav (docs/10 §5).
 * Capture is the "+" circle in each screen header (opens the /capture modal).
 */
export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      tabBar={(p) => <BottomNav state={p.state} navigation={p.navigation} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.surface } }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="focus" options={{ title: "Focus timer" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
