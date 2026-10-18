import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { f, floatShadow, radius, space } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";
import { Icon } from "./Icon";

/** Small calm confirmation ("Saved"). Shows for ~1.5 s each time `token` changes. */
export function Toast({ message, token }: { message: string; token: number }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (token === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1_500);
    return () => clearTimeout(t);
  }, [token]);
  if (!visible) return null;
  return (
    <View style={s.toast} accessibilityLiveRegion="polite" accessibilityRole="alert" pointerEvents="none">
      <View style={s.tick}>
        <Icon name="done" size={14} color={c.onFill} strokeWidth={2.5} />
      </View>
      <Text style={s.text}>{message}</Text>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    toast: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: space(1),
      paddingLeft: space(1),
      paddingRight: space(2),
      paddingVertical: space(1),
      backgroundColor: c.hero,
      borderRadius: radius.pill,
      ...floatShadow,
    },
    tick: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.lime, alignItems: "center", justifyContent: "center" },
    text: { ...f(600, 15), color: c.onHero },
  });
