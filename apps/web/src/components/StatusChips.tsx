import type { ComponentType } from "react";
import type { MissionStatus } from "@tatakae/core";
import { DashIcon, DoneMarkIcon, HalfMarkIcon, RescheduleIcon } from "./icons";

/**
 * One-tap chips: Done / Minimum / Missed / Reschedule. Icon + label, never colour alone; the selected
 * chip also gets aria-pressed and a paper border. Missed is grey (muted), never red. 44 px targets.
 * Tapping the selected chip again sets the mission back to open (except Reschedule, which moves it).
 */

type ChipStatus = Extract<MissionStatus, "done" | "minimum" | "missed" | "rescheduled">;

const CHIPS: readonly { status: ChipStatus; label: string; Icon: ComponentType<{ className?: string; size?: number }>; tone: string; selected: string }[] = [
  { status: "done", label: "Done", Icon: DoneMarkIcon, tone: "text-jade", selected: "bg-jade-soft" },
  { status: "minimum", label: "Minimum", Icon: HalfMarkIcon, tone: "text-jade", selected: "bg-jade-soft" },
  { status: "missed", label: "Missed", Icon: DashIcon, tone: "text-muted", selected: "bg-ink-3" },
  { status: "rescheduled", label: "Reschedule", Icon: RescheduleIcon, tone: "text-muted", selected: "bg-ink-3" },
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
}) {
  const chips = props.hideReschedule ? CHIPS.filter((c) => c.status !== "rescheduled") : CHIPS;
  return (
    <div role="group" aria-label={`Status of ${props.label}`} className="flex flex-wrap gap-2">
      {chips.map(({ status, label, Icon, tone, selected }) => {
        const active = props.value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            disabled={props.disabled}
            onClick={() => props.onChange(active && status !== "rescheduled" ? "open" : status)}
            className={`inline-flex min-h-tap items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-base ease-out disabled:opacity-50 ${
              active ? `border-paper ${selected}` : "border-line-strong hover:bg-ink-3"
            }`}
          >
            <Icon size={18} className={tone} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
