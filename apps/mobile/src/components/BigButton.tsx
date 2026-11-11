import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../lib/theme";
import { Icon, type AppIcon } from "./Icon";

export type BigButtonVariant = "primary" | "accent" | "secondary" | "quiet" | "danger";

export interface BigButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary = charcoal pill (one per screen); accent = lime pill (Start, Save on a light sheet);
   * secondary = surface-2 pill; quiet = text only; danger = destructive confirm only.
   */
  variant?: BigButtonVariant;
  icon?: AppIcon;
  disabled?: boolean;
  busy?: boolean;
  /** "large" = 64dp (Start, Save), "normal" = 52dp, "compact" = 44dp. */
  size?: "large" | "normal" | "compact";
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT = { large: 64, normal: 52, compact: minTarget } as const;

/** The one obvious action on a screen. Pill shape, 44dp minimum; the label never relies on colour. */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  busy = false,
  size = "normal",
  accessibilityHint,
  accessibilityLabel,
  style,
}: BigButtonProps) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const inactive = disabled || busy;
  const fg = { primary: c.onHero, accent: c.onFill, secondary: c.ink, quiet: c.ink, danger: c.white }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [s.base, { minHeight: HEIGHT[size] }, s[variant], pressed && !inactive && pressedStyle, inactive && s.inactive, style]}
    >
      <View style={s.row}>
        {busy ? <ActivityIndicator color={fg} /> : null}
        {icon && !busy ? <Icon name={icon} color={fg} size={size === "large" ? 22 : 20} strokeWidth={2} /> : null}
        <Text style={[s.label, size === "large" && s.labelLarge, variant === "quiet" && s.quietLabel, { color: fg }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    base: { borderRadius: radius.pill, paddingHorizontal: space(2.5), alignItems: "center", justifyContent: "center", minWidth: minTarget },
    row: { flexDirection: "row", alignItems: "center", gap: space(1) },
    primary: { backgroundColor: c.hero },
    accent: { backgroundColor: c.lime },
    secondary: { backgroundColor: c.surface2 },
    quiet: { backgroundColor: "transparent", paddingHorizontal: space(1.5) },
    danger: { backgroundColor: c.danger },
    inactive: { opacity: 0.45 },
    label: { ...f(600, 16), textAlign: "center" },
    labelLarge: { ...f(600, 18) },
    quietLabel: { textDecorationLine: "underline" },
  });
