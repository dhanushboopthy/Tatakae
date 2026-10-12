import type { CalendarDay, ISODate } from "@tatakae/core";
import { weekdayInitial } from "../lib/format";
import { DayCircle } from "./DayCircle";

/** Week strip (docs/11 §4, ref 02): 7 day circles with weekday letters; today charcoal. */
export function WeekStrip(props: { days: readonly CalendarDay[]; selected?: ISODate; onSelect?: (date: ISODate) => void }) {
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="This week">
      {props.days.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-1">
          <span aria-hidden="true" className="text-[12px] font-semibold text-ink-2">
            {weekdayInitial(d.date)}
          </span>
          <DayCircle
            date={d.date}
            state={d.state}
            hasNote={d.hasNote}
            final={d.final}
            size={40}
            selected={props.selected === d.date}
            onClick={props.onSelect ? () => props.onSelect?.(d.date) : undefined}
          />
        </li>
      ))}
    </ol>
  );
}
