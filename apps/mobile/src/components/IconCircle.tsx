import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { iconCircle } from "../theme";
import { pressedStyle, useTheme } from "../lib/theme";
import { tapLight } from "../haptics";
import { Icon, type AppIcon } from "./Icon";

export type IconCircleVariant = "neutral" | "primary" | "soft" | "white" | "accent";

/**
 * 48 circle with one icon (docs/10 §5): neutral = surface-2, primary = charcoal, soft = lavender-soft,
 * white = on coloured cards, accent = lime. With `onPress` it is a button and needs a label.
 */
export function IconCircle(props: {
  icon: AppIcon;
  variant?: IconCircleVariant;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const size = props.size ?? iconCircle;
  const variant = props.variant ?? "neutral";
  const bg = { neutral: c.surface2, primary: c.hero, soft: c.lavenderSoft, white: c.white, accent: c.lime }[variant];
  const fg = { neutral: c.ink, primary: c.onHero, soft: c.onFill, white: c.onFill, accent: c.onFill }[variant];
  const shape = [styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, props.style];
  const icon = <Icon name={props.icon} color={fg} size={Math.round(size * 0.46)} />;
  if (!props.onPress) {
    return (
      <View style={shape} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon}
      </View>
    );
  }
  const onPress = props.onPress;
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled: props.disabled === true }}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={({ pressed }) => [shape, pressed && pressedStyle, props.disabled && styles.disabled]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
