import type { ComponentType } from "react";
import type { MissionStatus } from "@tatakae/core";
import { DashIcon, DoneMarkIcon, HalfMarkIcon, RescheduleIcon, type IconProps } from "./icons";

/**
 * One-tap chips (docs/10 §5): Done (lime fill, ✓) · Minimum (lavender hatch, ◐) · Missed (grey border, —)
 * · Reschedule (outline, →). Icon + label, never colour alone; the selected chip also gets aria-pressed.
 * Missed is grey, never red. 44 px targets. Tapping the selected chip again sets the mission back to open
 * (except Reschedule, which moves it).
 */

type ChipStatus = Extract<MissionStatus, "done" | "minimum" | "missed" | "rescheduled">;

const CHIPS: readonly { status: ChipStatus; label: string; Icon: ComponentType<IconProps>; selected: string }[] = [
  { status: "done", label: "Done", Icon: DoneMarkIcon, selected: "bg-lime text-on-accent border-lime-deep" },
  { status: "minimum", label: "Minimum", Icon: HalfMarkIcon, selected: "hatch-min text-on-accent border-lavender-deep" },
  { status: "missed", label: "Missed", Icon: DashIcon, selected: "bg-surface text-ink border-missed" },
  { status: "rescheduled", label: "Reschedule", Icon: RescheduleIcon, selected: "bg-surface text-ink border-ink" },
];

export const STATUS_LABEL: Record<MissionStatus, string> = {
  open: "Open",
  done: "Done",
  minimum: "Minimum",
  missed: "Missed",
  rescheduled: "Rescheduled",
  backlog: "Backlog",
};

export function StatusChips(props: {
  value: MissionStatus;
  onChange: (s: MissionStatus) => void;
  /** Mission title, for screen-reader labels. */
  label: string;
  disabled?: boolean;
  /** Hide Reschedule (e.g. in the ritual, where unfinished work gets a resume note instead). */
  hideReschedule?: boolean;
  /** On a coloured card: unselected chips sit on white instead of surface-2. */
  onColor?: boolean;
}) {
  const chips = props.hideReschedule ? CHIPS.filter((c) => c.status !== "rescheduled") : CHIPS;
  const idle = props.onColor ? "bg-white/70 text-on-accent hover:bg-white" : "bg-surface-2 text-ink hover:bg-line";
  return (
    <div role="group" aria-label={`Status of ${props.label}`} className="flex flex-wrap gap-2">
      {chips.map(({ status, label, Icon, selected }) => {
        const active = props.value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            disabled={props.disabled}
            onClick={() => props.onChange(active && status !== "rescheduled" ? "open" : status)}
            className={`chip border-2 disabled:opacity-50 ${active ? selected : `border-transparent ${idle}`}`}
          >
            <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
