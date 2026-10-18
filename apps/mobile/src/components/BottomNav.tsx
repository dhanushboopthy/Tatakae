import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { f, floatShadow, radius, space } from "../theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../lib/theme";
import { tapLight } from "../haptics";
import { Icon, type AppIcon } from "./Icon";

/** Room to leave under scroll content so the floating nav never covers the last card. */
export const NAV_SPACE = 104;

const TABS: Record<string, { icon: AppIcon; label: string }> = {
  index: { icon: "today", label: "Today" },
  calendar: { icon: "calendar", label: "Calendar" },
  focus: { icon: "focus", label: "Focus" },
  settings: { icon: "settings", label: "Settings" },
};

/** The slice of the tab bar props this component uses (structurally compatible with react-navigation's). */
export interface NavProps {
  state: { index: number; routes: readonly { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

/**
 * Floating charcoal pill nav (docs/10 §5): 4 icons, active tab = white pill with the icon and its
 * label, 16 above the bottom edge. Every item is 52 high and labelled for screen readers.
 */
export function BottomNav({ state, navigation }: NavProps) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { bottom: insets.bottom + space(2) }]} pointerEvents="box-none">
      <View style={s.nav} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                tapLight();
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ pressed }) => [s.item, focused && s.active, pressed && pressedStyle]}
            >
              <Icon name={tab.icon} color={focused ? c.onFill : c.navIcon} />
              {focused ? <Text style={s.label}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
    nav: { flexDirection: "row", gap: 6, padding: space(1), borderRadius: radius.pill, backgroundColor: c.nav, ...floatShadow },
    item: { height: 52, minWidth: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space(1) },
    active: { backgroundColor: c.white, paddingHorizontal: space(2.25) },
    label: { ...f(600, 14), color: c.onFill },
  });
