import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MissionStatus } from "@tatakae/core";
import { colors, minTarget, radius, space, type } from "../theme";
import { tapLight } from "../haptics";

/** Text glyphs, not an icon font. Shape + label carry the meaning; colour is only a third cue. */
export const STATUS_GLYPH: Record<MissionStatus, string> = {
  open: "○",
  done: "✓",
  minimum: "½",
  missed: "–",
  rescheduled: "↻",
  backlog: "○",
};

export const STATUS_LABEL: Record<MissionStatus, string> = {
  open: "Open",
  done: "Done",
  minimum: "Minimum",
  missed: "Missed",
  rescheduled: "Rescheduled",
  backlog: "Backlog",
};

type Chip = "done" | "minimum" | "missed" | "rescheduled";
const CHIPS: readonly { status: Chip; label: string; hint: string }[] = [
  { status: "done", label: "Done", hint: "Full points" },
  { status: "minimum", label: "Minimum", hint: "Half points. The minimum version counts" },
  { status: "missed", label: "Missed", hint: "Turns grey. Nothing resets" },
  { status: "rescheduled", label: "Reschedule", hint: "Moves this mission to the backlog" },
];

export interface StatusChipsProps {
  status: MissionStatus;
  onChange: (next: MissionStatus) => void;
  disabled?: boolean;
  /** Hide Reschedule (e.g. in Quick close, where it is still allowed but rarely wanted). */
  hideReschedule?: boolean;
  /** Mission title, read by screen readers with each chip. */
  missionTitle?: string;
}

/**
 * Done / Minimum / Missed / Reschedule — glyph + label, never colour alone. Tapping the selected chip
 * again sets the mission back to open (undo). Reschedule is a one-way action.
 */
export function StatusChips({ status, onChange, disabled = false, hideReschedule = false, missionTitle }: StatusChipsProps) {
  const chips = hideReschedule ? CHIPS.filter((c) => c.status !== "rescheduled") : CHIPS;
  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel={missionTitle ? `Status for ${missionTitle}` : "Status"}>
      {chips.map((c) => {
        const selected = status === c.status;
        return (
          <Pressable
            key={c.status}
            disabled={disabled}
            onPress={() => {
              tapLight();
              onChange(selected && c.status !== "rescheduled" ? "open" : c.status);
            }}
            accessibilityRole="button"
            accessibilityLabel={missionTitle ? `${c.label}, ${missionTitle}` : c.label}
            accessibilityHint={selected ? "Selected. Tap again to set back to open" : c.hint}
            accessibilityState={{ selected, disabled }}
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              selected && c.status === "done" && styles.doneOn,
              selected && c.status === "minimum" && styles.minimumOn,
              selected && c.status === "missed" && styles.missedOn,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.glyph,
                c.status === "done" && styles.jadeGlyph,
                c.status === "minimum" && styles.jadeGlyph,
                c.status === "missed" && styles.mutedGlyph,
                c.status === "rescheduled" && styles.mutedGlyph,
                selected && (c.status === "done" || c.status === "missed") && styles.inkText,
              ]}
            >
              {STATUS_GLYPH[c.status]}
            </Text>
            <Text style={[styles.label, selected && (c.status === "done" || c.status === "missed") && styles.inkText]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
  chip: {
    minHeight: minTarget,
    minWidth: minTarget,
    paddingHorizontal: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ink3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneOn: { backgroundColor: colors.jade, borderColor: colors.paper },
  minimumOn: { backgroundColor: colors.jadeSoft, borderColor: colors.jade, borderWidth: 2 },
  missedOn: { backgroundColor: colors.muted, borderColor: colors.paper },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  glyph: { fontSize: type.body, fontWeight: "700", color: colors.paper },
  jadeGlyph: { color: colors.jade },
  mutedGlyph: { color: colors.muted },
  inkText: { color: colors.ink },
  label: { fontSize: type.small, fontWeight: "600", color: colors.paper },
});
