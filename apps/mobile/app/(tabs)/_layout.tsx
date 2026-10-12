import { StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, type } from "../../src/theme";

/** Text glyphs instead of an icon library; the label is always shown too. */
function Glyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={[styles.glyph, { color: focused ? colors.paper : colors.muted }]}>{glyph}</Text>;
}

function CaptureGlyph({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.capture, focused && styles.captureFocused]}>
      <Text style={styles.captureGlyph}>+</Text>
    </View>
  );
}

/** Bottom tabs: Today · Focus · Capture (centre, large) · Settings. Dark, 44dp+ targets. */
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
        name="focus"
        options={{
          title: "Focus",
          tabBarAccessibilityLabel: "Focus timer",
          tabBarIcon: ({ focused }) => <Glyph glyph="◔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarAccessibilityLabel: "Capture to inbox",
          tabBarIcon: ({ focused }) => <CaptureGlyph focused={focused} />,
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
  capture: {
    width: 52,
    height: 52,
    marginTop: -14,
    borderRadius: 26,
    backgroundColor: colors.ember,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink2,
  },
  captureFocused: { borderColor: colors.paper },
  captureGlyph: { color: colors.ink, fontSize: type.h1 + 6, lineHeight: 32, fontWeight: "700" },
});
