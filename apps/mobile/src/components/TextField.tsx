import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { f, minTarget, space } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";

export interface TextFieldProps extends TextInputProps {
  /** Visible label above the field (also the accessibility label unless one is given). */
  label?: string;
  /** Quiet line under the field. */
  hint?: string;
  /** surface2 on a white screen (default); surface on the canvas of a sheet. */
  tone?: "surface" | "surface2";
  containerStyle?: StyleProp<ViewStyle>;
}

/** Text input in the Soft Bento style: 52 tall, rounded, ink text, ink-2 placeholder (5.7:1). */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, tone, containerStyle, style, multiline, ...rest },
  ref,
) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  return (
    <View style={[s.wrap, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={c.ink2}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        multiline={multiline}
        style={[s.input, tone === "surface" && s.onCanvas, multiline && s.multiline, style]}
        {...rest}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
});

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(0.75) },
    label: { ...f(600, 13, 18), color: c.ink },
    input: {
      minHeight: minTarget + 8,
      borderRadius: 18,
      backgroundColor: c.surface2,
      paddingHorizontal: space(2),
      paddingVertical: space(1.25),
      color: c.ink,
      ...f(500, 16),
    },
    onCanvas: { backgroundColor: c.surface },
    multiline: { minHeight: 96, textAlignVertical: "top" },
    hint: { ...f(500, 13, 18), color: c.ink2 },
  });
