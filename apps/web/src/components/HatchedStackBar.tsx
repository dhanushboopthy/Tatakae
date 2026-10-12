import { weekdayOf, type CalendarDay, type ISODate } from "@tatakae/core";
import { formatDay, weekdayInitial } from "../lib/format";

/**
 * Per-day stacked bars (docs/11 C1, ref 03): done = lime with a deep top edge, minimum = lavender
 * 45° hatch, missed = grey hatch with a grey edge, still open = dashed outline. Rounded tops; day letter
 * and date circle under each bar (today charcoal). The text summary is rendered by the caller.
 */
export function HatchedStackBar(props: {
  days: readonly CalendarDay[];
  today: ISODate;
  height?: number;
  summary: string;
  onSelect?: (date: ISODate) => void;
}) {
  const h = props.height ?? 170;
  const max = Math.max(3, ...props.days.map((d) => d.done + d.minimum + d.missed + d.open));
  const px = (points: number) => Math.round((points / max) * (h - 8));
  const describe = (d: CalendarDay) => {
    const parts = [
      d.done ? `${d.done} done` : "",
      d.minimum ? `${d.minimum} minimum` : "",
      d.missed ? `${d.missed} missed` : "",
      d.open ? `${d.open} open` : "",
    ].filter(Boolean);
    return `${formatDay(d.date)}: ${parts.length ? parts.join(", ") : "nothing planned"}`;
  };

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`Points per day. ${props.days.map(describe).join("; ")}.`}
        className="grid items-end gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${props.days.length}, minmax(0, 1fr))`, height: h }}
      >
        {props.days.map((d) => (
          <div
            key={d.date}
            title={describe(d)}
            className={`flex h-full flex-col justify-end overflow-hidden rounded-[14px] bg-surface-2 ${
              d.date === props.today ? "outline outline-2 outline-offset-2 outline-charcoal" : ""
            }`}
          >
            {d.open > 0 && (
              <div className="rounded-t-[10px] border-2 border-dashed border-missed" style={{ height: px(d.open) }} />
            )}
            {d.missed > 0 && <div className="hatch-missed border-t-2 border-missed" style={{ height: px(d.missed) }} />}
            {d.minimum > 0 && <div className="hatch-min" style={{ height: px(d.minimum) }} />}
            {d.done > 0 && <div className="border-t-2 border-lime-deep bg-lime" style={{ height: px(d.done) }} />}
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-2 grid gap-2 text-center text-[13px] font-semibold sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${props.days.length}, minmax(0, 1fr))` }}
      >
        {props.days.map((d) => {
          const isToday = d.date === props.today;
          const label = (
            <>
              {weekdayInitial(d.date)}
              <br />
              <span
                className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full font-medium ${
                  isToday ? "bg-charcoal text-on-charcoal" : "text-ink-2"
                }`}
              >
                {Number(d.date.slice(8))}
              </span>
            </>
          );
          return props.onSelect ? (
            <button key={d.date} type="button" tabIndex={-1} onClick={() => props.onSelect?.(d.date)}>
              {label}
            </button>
          ) : (
            <span key={d.date}>{label}</span>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
        <span>{props.summary}</span>
        <BarLegend />
      </figcaption>
    </figure>
  );
}

export function BarLegend() {
  return (
    <span className="flex flex-wrap gap-3" aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border-[1.5px] border-lime-deep bg-lime" />
        Done
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hatch-min h-3 w-3 rounded" />
        Minimum
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hatch-missed h-3 w-3 rounded border-[1.5px] border-missed" />
        Missed
      </span>
    </span>
  );
}

/** Monday-first weekday index helper used by week views. */
export const isoWeekday = (date: ISODate) => (weekdayOf(date) + 6) % 7;
