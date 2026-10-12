import type { CalendarState, ISODate } from "@tatakae/core";
import { STATE_LABEL } from "../lib/colors";
import { formatDay } from "../lib/format";

/**
 * Calendar day cell (docs/11 §4): Strong = lime, Solid = lavender, Light = lime-soft + lime-deep ring,
 * Missed = surface-2 + grey dash, Rest / write-off = hollow ring (dashed for write-off), Today = charcoal,
 * Future = plain number. A dot under the circle marks a reflection / small win.
 */

const STYLE: Record<CalendarState, string> = {
  Strong: "bg-lime text-on-accent font-semibold",
  Solid: "bg-lavender text-on-accent font-semibold",
  Light: "bg-lime-soft text-ink font-semibold shadow-[inset_0_0_0_2px_#7E9A1E]",
  Missed: "bg-surface-2 text-ink",
  Rest: "text-ink shadow-[inset_0_0_0_2px_rgb(var(--missed))]",
  WriteOff: "text-ink border-2 border-dashed border-missed",
  Today: "bg-charcoal text-on-charcoal font-semibold",
  Future: "text-ink-2",
  Unplanned: "text-ink-2",
};

export function DayCircle(props: {
  date: ISODate;
  state: CalendarState;
  hasNote?: boolean;
  final?: number | null;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const size = props.size ?? 44;
  const day = Number(props.date.slice(8, 10));
  const label = `${formatDay(props.date)}: ${STATE_LABEL[props.state]}${props.final != null ? `, score ${props.final}` : ""}${
    props.hasNote ? ", has a reflection" : ""
  }`;
  const circle = (
    <span
      className={`tnum relative flex items-center justify-center rounded-full text-[15px] ${STYLE[props.state]} ${
        props.selected ? "outline outline-2 outline-offset-2 outline-ink" : ""
      }`}
      style={{ width: size, height: size }}
    >
      {day}
      {props.state === "Missed" && (
        <span aria-hidden="true" className="absolute bottom-[7px] h-[2px] w-3 rounded-full bg-missed" />
      )}
    </span>
  );
  const dot = (
    <span aria-hidden="true" className={`mt-1 h-1.5 w-1.5 rounded-full ${props.hasNote ? "bg-ink" : "bg-transparent"}`} />
  );
  if (props.onClick) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        aria-label={label}
        aria-pressed={props.selected}
        className="flex min-h-tap min-w-tap flex-col items-center justify-center rounded-full"
      >
        {circle}
        {dot}
      </button>
    );
  }
  return (
    <span role="img" aria-label={label} className="flex flex-col items-center">
      {circle}
      {dot}
    </span>
  );
}

/** Legend row for day circles (shape + colour + label). */
export function DayLegend() {
  const items: [CalendarState, string][] = [
    ["Strong", "Strong ≥ 80"],
    ["Solid", "Solid 50–79"],
    ["Light", "Light"],
    ["Missed", "Missed"],
    ["Rest", "Rest"],
    ["Today", "Today"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-2" aria-label="Legend">
      {items.map(([state, text]) => (
        <li key={state} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`relative inline-block h-3.5 w-3.5 rounded-full ${STYLE[state]}`} />
          {text}
        </li>
      ))}
    </ul>
  );
}
