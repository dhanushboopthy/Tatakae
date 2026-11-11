import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MissionStatus } from "@tatakae/core";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
import { tapLight } from "../haptics";
import { Icon, type AppIcon } from "./Icon";

/** Text glyphs for compact status tags. Shape + label carry the meaning; colour is only a third cue. */
export const STATUS_GLYPH: Record<MissionStatus, string> = {
  open: "○",
  done: "✓",
  minimum: "◐",
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
const CHIPS: readonly { status: Chip; label: string; hint: string; icon: AppIcon }[] = [
  { status: "done", label: "Done", hint: "Full points", icon: "done" },
  { status: "minimum", label: "Minimum", hint: "Half points. The minimum version counts", icon: "minimum" },
  { status: "missed", label: "Missed", hint: "Turns grey. Nothing resets", icon: "missed" },
  { status: "rescheduled", label: "Reschedule", hint: "Moves this mission to the backlog", icon: "reschedule" },
];

export interface StatusChipsProps {
  status: MissionStatus;
  onChange: (next: MissionStatus) => void;
  disabled?: boolean;
  /** Hide Reschedule (Quick close, where it is rarely wanted). */
  hideReschedule?: boolean;
  /** Mission title, read by screen readers with each chip. */
  missionTitle?: string;
}

/**
 * Done (lime, ✓) / Minimum (lavender, ◐) / Missed (grey border, —) / Reschedule (→) — icon + label,
 * never colour alone (docs/10 §5). White pills with ink text work on every card colour in both themes.
 * Tapping the selected chip again sets the mission back to open (undo). Reschedule is one-way.
 */
export function StatusChips({ status, onChange, disabled = false, hideReschedule = false, missionTitle }: StatusChipsProps) {
  const s = useStyles(makeStyles);
  const chips = hideReschedule ? CHIPS.filter((c) => c.status !== "rescheduled") : CHIPS;
  return (
    <View style={s.row} accessibilityRole="toolbar" accessibilityLabel={missionTitle ? `Status for ${missionTitle}` : "Status"}>
      {chips.map((chip) => {
        const selected = status === chip.status;
        return (
          <Pressable
            key={chip.status}
            disabled={disabled}
            onPress={() => {
              tapLight();
              onChange(selected && chip.status !== "rescheduled" ? "open" : chip.status);
            }}
            accessibilityRole="button"
            accessibilityLabel={missionTitle ? `${chip.label}, ${missionTitle}` : chip.label}
            accessibilityHint={selected ? "Selected. Tap again to set back to open" : chip.hint}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
              s.chip,
              selected && s.selected,
              selected && s[chip.status],
              pressed && pressedStyle,
              disabled && s.disabled,
            ]}
          >
            <Icon name={chip.icon} color={s.text.color} size={18} strokeWidth={2} />
            <Text style={s.text}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: space(0.75) },
    chip: {
      minHeight: minTarget,
      paddingHorizontal: space(1.5),
      borderRadius: radius.pill,
      backgroundColor: c.white,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 2,
      // Faint ink edge so a white chip still shows on a white card; selected chips get a solid one.
      borderColor: c.chipEdge,
    },
    selected: { borderWidth: 2, borderColor: c.onFill },
    done: { backgroundColor: c.lime },
    minimum: { backgroundColor: c.lavender },
    missed: { backgroundColor: c.white, borderColor: c.missed },
    rescheduled: {},
    disabled: { opacity: 0.5 },
    text: { ...f(600, 13), color: c.onFill },
  });
