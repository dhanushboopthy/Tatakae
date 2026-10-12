import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Mission, MissionStatus, Slot } from "@tatakae/core";
import { colors, minTarget, legacyRadius, space, text, type } from "../theme";
import { STATUS_GLYPH, STATUS_LABEL, StatusChips } from "./StatusChips";

export const SLOT_LABEL: Record<Slot, string> = { P1: "P1", P2: "P2", P3: "P3", side: "Side quest", backlog: "Backlog" };

export interface MissionCardProps {
  mission: Mission;
  /** Day is forged: editing locked fields asks for a reason. */
  locked?: boolean;
  onStatus: (next: MissionStatus) => void;
  onStuck?: () => void;
  onEdit?: () => void;
  onFocus?: () => void;
}

/** One mission with one-tap chips. Missed and rescheduled render grey, never red. */
export function MissionCard({ mission: m, locked = false, onStatus, onStuck, onEdit, onFocus }: MissionCardProps) {
  const grey = m.status === "missed" || m.status === "rescheduled";
  const isSide = m.slot === "side";
  return (
    <View style={[styles.card, m.slot === "P1" && styles.p1Edge, grey && styles.greyCard]}>
      <View style={styles.head}>
        <Text style={[styles.slot, m.slot === "P1" && styles.slotP1]}>{SLOT_LABEL[m.slot]}</Text>
        {isSide ? <Text style={text.small}>unscored</Text> : null}
        {locked ? (
          <Text style={text.small} accessibilityLabel="Plan locked">
            · locked
          </Text>
        ) : null}
        <View style={styles.flex} />
        {m.status !== "open" ? (
          <Text style={[styles.statusTag, m.status === "done" || m.status === "minimum" ? styles.jade : styles.muted]}>
            {STATUS_GLYPH[m.status]} {STATUS_LABEL[m.status]}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.title, grey && styles.muted]} accessibilityRole="header">
        {m.title}
      </Text>
      {m.minimum ? <Text style={text.small}>Minimum: {m.minimum}</Text> : null}
      {m.resumeNote ? <Text style={text.small}>Resume: {m.resumeNote}</Text> : null}

      {m.status === "rescheduled" ? (
        <Text style={text.small}>Moved to the backlog. Pick it up in the night ritual.</Text>
      ) : (
        <StatusChips status={m.status} onChange={onStatus} missionTitle={m.title} />
      )}

      {m.status !== "rescheduled" && (onFocus || onStuck || onEdit) ? (
        <View style={styles.links}>
          {onFocus && m.status === "open" ? <CardLink label="Focus" onPress={onFocus} hint="Start a focus block on this mission" /> : null}
          {onStuck && m.status === "open" ? <CardLink label="Stuck" onPress={onStuck} hint="Name what is in the way" /> : null}
          {onEdit ? <CardLink label="Edit" onPress={onEdit} hint={locked ? "Plan is locked. A change needs a short reason" : undefined} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function CardLink({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink2,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: legacyRadius.card,
    padding: space(2),
    gap: space(1),
  },
  p1Edge: { borderLeftWidth: 3, borderLeftColor: colors.ember },
  greyCard: { backgroundColor: colors.ink },
  head: { flexDirection: "row", alignItems: "center", gap: space(1) },
  flex: { flex: 1 },
  slot: { color: colors.muted, fontSize: type.small, fontWeight: "700", letterSpacing: 0.5 },
  slotP1: { color: colors.ember },
  statusTag: { fontSize: type.small, fontWeight: "600" },
  jade: { color: colors.jade },
  muted: { color: colors.muted },
  title: { color: colors.paper, fontSize: type.h2, lineHeight: 26, fontWeight: "600" },
  links: { flexDirection: "row", gap: space(1), marginTop: -space(0.5) },
  link: { minHeight: minTarget, minWidth: minTarget, justifyContent: "center", paddingHorizontal: space(1) },
  linkText: { color: colors.paper, fontSize: type.small, fontWeight: "600", textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
});
