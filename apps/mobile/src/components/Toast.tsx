import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, legacyRadius, space, type } from "../theme";

/** Small calm confirmation ("Saved"). Shows for ~1.5 s each time `token` changes. */
export function Toast({ message, token }: { message: string; token: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (token === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1_500);
    return () => clearTimeout(t);
  }, [token]);
  if (!visible) return null;
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert" pointerEvents="none">
      <Text style={styles.glyph}>✓</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    paddingHorizontal: space(2),
    paddingVertical: space(1),
    backgroundColor: colors.ink2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: legacyRadius.pill,
    elevation: 6,
  },
  glyph: { color: colors.jade, fontSize: type.body, fontWeight: "700" },
  text: { color: colors.paper, fontSize: type.body },
});
