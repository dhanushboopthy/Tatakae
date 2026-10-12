import { monthGrid, type CalendarDay, type ISODate } from "@tatakae/core";
import { STATE_LABEL } from "../lib/colors";
import { formatDay } from "../lib/format";
import { DayCircle } from "./DayCircle";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Month grid of day circles (docs/11 §4). `large` = web month view: each cell is a tile with the circle,
 * a mini 3-segment bar (done / minimum / missed) and the screen-minutes number.
 */
export function MonthCalendar(props: {
  month: string; // "YYYY-MM"
  days: readonly CalendarDay[];
  selected?: ISODate | null;
  onSelect?: (date: ISODate) => void;
  large?: boolean;
}) {
  const grid = monthGrid(props.month, props.days);
  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1">
      <thead>
        <tr>
          {WEEKDAYS.map((w) => (
            <th key={w} scope="col" className="pb-2 text-center text-[13px] font-semibold text-ink-2">
              {w}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.map((week, i) => (
          <tr key={i}>
            {week.map((d, j) =>
              d ? (
                <td key={d.date} className="p-0.5 align-top">
                  {props.large ? (
                    <LargeCell day={d} selected={props.selected === d.date} onSelect={props.onSelect} />
                  ) : (
                    <div className="flex justify-center">
                      <DayCircle
                        date={d.date}
                        state={d.state}
                        hasNote={d.hasNote}
                        final={d.final}
                        selected={props.selected === d.date}
                        onClick={props.onSelect ? () => props.onSelect?.(d.date) : undefined}
                      />
                    </div>
                  )}
                </td>
              ) : (
                <td key={`pad-${i}-${j}`} aria-hidden="true" />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LargeCell({ day: d, selected, onSelect }: { day: CalendarDay; selected: boolean; onSelect?: (date: ISODate) => void }) {
  const total = d.done + d.minimum + d.missed + d.open;
  const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  const label = `${formatDay(d.date)}: ${STATE_LABEL[d.state]}${d.final != null ? `, score ${d.final}` : ""}${
    d.screenMin != null ? `, ${d.screenMin} screen minutes` : ""
  }`;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(d.date)}
      aria-label={label}
      aria-pressed={selected}
      className={`flex h-full min-h-[104px] w-full flex-col items-center gap-1.5 rounded-card-inner p-2 transition hover:bg-surface-2 ${
        selected ? "bg-surface-2 outline outline-2 outline-ink" : ""
      }`}
    >
      <DayCircle date={d.date} state={d.state} hasNote={d.hasNote} size={40} />
      {total > 0 ? (
        <span aria-hidden="true" className="flex h-1.5 w-full max-w-[64px] overflow-hidden rounded-full bg-surface-2">
          <span className="h-full bg-lime-deep" style={{ width: seg(d.done) }} />
          <span className="h-full bg-lavender-deep" style={{ width: seg(d.minimum) }} />
          <span className="h-full bg-missed" style={{ width: seg(d.missed) }} />
        </span>
      ) : (
        <span aria-hidden="true" className="h-1.5" />
      )}
      <span aria-hidden="true" className="tnum text-[11px] font-medium text-ink-2">
        {d.screenMin != null ? `${d.screenMin} min` : " "}
      </span>
    </button>
  );
}
