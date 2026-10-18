import type { ReactElement, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { f, radius, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { IconCircle } from "./IconCircle";
import { NAV_SPACE } from "./BottomNav";

/**
 * A scrolling screen on the white surface (docs/10 §6). `tab` leaves room for the floating nav;
 * sheets (modals) set `sheet` for the canvas background behind their cards.
 */
export function Screen(props: {
  children: ReactNode;
  tab?: boolean;
  sheet?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Extra content pinned under the scroll view (a primary action). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const s = useStyles(makeStyles);
  return (
    <SafeAreaView style={[s.screen, props.sheet && s.sheet]} edges={props.sheet ? ["top", "bottom"] : ["top"]}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, props.tab && { paddingBottom: NAV_SPACE }, props.contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={props.refreshControl}
        >
          {props.children}
        </ScrollView>
        {props.footer ? <View style={s.footer}>{props.footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Page header: small line over a 30 title; circle buttons at the right. */
export function ScreenHeader(props: { eyebrow?: string; title: string; right?: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        {props.eyebrow ? <Text style={s.eyebrow}>{props.eyebrow}</Text> : null}
        <Text style={s.title} accessibilityRole="header">
          {props.title}
        </Text>
      </View>
      {props.right ? <View style={s.actions}>{props.right}</View> : null}
    </View>
  );
}

/** Modal title row with a 48 close circle. */
export function SheetHeader(props: { title: string; subtitle?: string; onClose: () => void; closeLabel?: string; right?: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        <Text style={s.sheetTitle} accessibilityRole="header">
          {props.title}
        </Text>
        {props.subtitle ? <Text style={s.eyebrow}>{props.subtitle}</Text> : null}
      </View>
      <View style={s.actions}>
        {props.right}
        <IconCircle icon="close" onPress={props.onClose} accessibilityLabel={props.closeLabel ?? "Close"} />
      </View>
    </View>
  );
}

/** White (or surface-2 on a white screen) rounded card. */
export function Card(props: { children: ReactNode; tone?: "surface" | "surface2" | "lime" | "lavender" | "limeSoft" | "lavenderSoft"; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(makeStyles);
  return <View style={[s.card, s[props.tone ?? "surface2"], props.style]}>{props.children}</View>;
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.surface },
    sheet: { backgroundColor: c.canvas },
    fill: { flex: 1 },
    content: { paddingHorizontal: space(2.5), paddingTop: space(2), paddingBottom: space(4), gap: space(1.75) },
    footer: { paddingHorizontal: space(2.5), paddingTop: space(1), paddingBottom: space(2) },
    header: { flexDirection: "row", alignItems: "center", gap: space(1.5), marginBottom: space(0.5) },
    headerText: { flex: 1, gap: 2 },
    eyebrow: { ...f(500, 14, 20), color: c.ink2 },
    title: { ...f(600, 30, 36), color: c.ink, letterSpacing: -0.6 },
    sheetTitle: { ...f(600, 24, 30), color: c.ink, letterSpacing: -0.4 },
    actions: { flexDirection: "row", gap: space(1) },
    card: { borderRadius: radius.card, padding: space(2.5), gap: space(1.25) },
    surface: { backgroundColor: c.surface },
    surface2: { backgroundColor: c.surface2 },
    lime: { backgroundColor: c.lime },
    lavender: { backgroundColor: c.lavender },
    limeSoft: { backgroundColor: c.limeSoft },
    lavenderSoft: { backgroundColor: c.lavenderSoft },
  });
