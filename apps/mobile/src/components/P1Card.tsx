import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Mission } from "@tatakae/core";
import { colors, legacyRadius, space, text, type } from "../theme";

export interface P1CardProps {
  mission: Pick<Mission, "title" | "minimum" | "ifThen" | "resumeNote">;
  /** Actions under the card (Start buttons on Morning). */
  children?: ReactNode;
}

/** The morning's one mission: big title, Minimum, if-then. No stats, no story. */
export function P1Card({ mission, children }: P1CardProps) {
  return (
    <View style={styles.card} accessibilityLabel={`P1: ${mission.title}`}>
      <Text style={styles.slot}>P1</Text>
      <Text style={text.p1} accessibilityRole="header">
        {mission.title}
      </Text>
      {mission.minimum ? (
        <View style={styles.line}>
          <Text style={styles.key}>Minimum</Text>
          <Text style={text.body}>{mission.minimum}</Text>
        </View>
      ) : null}
      {mission.ifThen ? (
        <View style={styles.line}>
          <Text style={styles.key}>If-then</Text>
          <Text style={text.body}>{mission.ifThen}</Text>
        </View>
      ) : null}
      {mission.resumeNote ? (
        <View style={styles.line}>
          <Text style={styles.key}>Resume</Text>
          <Text style={text.body}>{mission.resumeNote}</Text>
        </View>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.emberSoft,
    borderColor: colors.ember,
    borderWidth: 1,
    borderRadius: legacyRadius.card,
    padding: space(2.5),
    gap: space(1.5),
  },
  slot: { color: colors.ember, fontSize: type.small, fontWeight: "700", letterSpacing: 1 },
  line: { gap: 2 },
  key: { color: colors.muted, fontSize: type.small, fontWeight: "600" },
  actions: { gap: space(1), marginTop: space(1) },
});
