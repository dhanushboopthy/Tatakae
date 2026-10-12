import { StyleSheet, Text } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

/** Text glyphs instead of an icon library; the label is always shown too. */
function Glyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={[styles.glyph, { color: focused ? colors.paper : colors.muted }]}>{glyph}</Text>;
}

/**
 * Tabs: Today · Calendar · Focus · Settings. Capture is the "+" circle in each screen header (opens /capture modal).
 * TODO(v1, docs/10 §5): floating charcoal pill nav — tabBar={(p) => <BottomNav {...p} />}, active tab = white circle.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        tabBarStyle: {
          backgroundColor: colors.ink2,
          borderTopColor: colors.line,
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.paper,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarAccessibilityLabel: "Today",
          tabBarIcon: ({ focused }) => <Glyph glyph="◉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarAccessibilityLabel: "Calendar",
          tabBarIcon: ({ focused }) => <Glyph glyph="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: "Focus",
          tabBarAccessibilityLabel: "Focus timer",
          tabBarIcon: ({ focused }) => <Glyph glyph="◔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarAccessibilityLabel: "Settings",
          tabBarIcon: ({ focused }) => <Glyph glyph={"⚙︎"} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 22, lineHeight: 26 },
});
