import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, minTarget, legacyRadius, space, type } from "../theme";

export type BigButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface BigButtonProps {
  label: string;
  onPress: () => void;
  /** primary = ember fill (one per screen); secondary = outlined; quiet = text only; danger = destructive confirm only. */
  variant?: BigButtonVariant;
  /** Small glyph shown before the label (text, not an icon font). */
  glyph?: string;
  disabled?: boolean;
  busy?: boolean;
  /** "large" = 64dp (Start, Save), "normal" = 52dp, "compact" = 44dp. */
  size?: "large" | "normal" | "compact";
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT = { large: 64, normal: 52, compact: minTarget } as const;

/** The one obvious action on a screen. 44dp minimum; label never relies on colour. */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  glyph,
  disabled = false,
  busy = false,
  size = "normal",
  accessibilityHint,
  accessibilityLabel,
  style,
}: BigButtonProps) {
  const inactive = disabled || busy;
  const fg = variant === "primary" || variant === "danger" ? colors.ink : colors.paper;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: HEIGHT[size] },
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "quiet" && styles.quiet,
        variant === "danger" && styles.danger,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={fg} /> : null}
        {glyph && !busy ? <Text style={[styles.glyph, { color: fg }]}>{glyph}</Text> : null}
        <Text style={[styles.label, size === "large" && styles.labelLarge, { color: fg }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: legacyRadius.control,
    paddingHorizontal: space(2),
    alignItems: "center",
    justifyContent: "center",
    minWidth: minTarget,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space(1) },
  primary: { backgroundColor: colors.ember },
  secondary: { backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.lineStrong },
  quiet: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  inactive: { opacity: 0.5 },
  glyph: { fontSize: type.h2, fontWeight: "600" },
  label: { fontSize: type.body, fontWeight: "600", textAlign: "center" },
  labelLarge: { fontSize: type.h2 },
});
