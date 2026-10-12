import { RAIL, hhmmOf } from "../lib/plan";

/** Hour labels at the left of the week planner (docs/10 §5, ref 07). `hourPx` = height of one hour. */
export function TimeRail({ hourPx }: { hourPx: number }) {
  const hours: number[] = [];
  for (let m = RAIL.startMin; m < RAIL.endMin; m += 60) hours.push(m);
  return (
    <div aria-hidden="true" className="relative w-12 shrink-0" style={{ height: ((RAIL.endMin - RAIL.startMin) / 60) * hourPx }}>
      {hours.map((m, i) => (
        <span key={m} className="tnum absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-2" style={{ top: i * hourPx }}>
          {i === 0 ? "" : hhmmOf(m)}
        </span>
      ))}
    </div>
  );
}

/** Hour gridlines for a day column. */
export function HourLines({ hourPx }: { hourPx: number }) {
  const n = (RAIL.endMin - RAIL.startMin) / 60;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="absolute inset-x-0 border-t border-line" style={{ top: i * hourPx }} />
      ))}
    </div>
  );
}

/** Current-time line: charcoal line with a dot (ref 07). `top` in px. */
export function NowLine({ top }: { top: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-charcoal" />
      <span className="absolute inset-x-0 border-t-2 border-charcoal" />
    </div>
  );
}
