import type { ISODate, SeriesPoint } from "@tatakae/core";
import { formatDay } from "../lib/format";

/**
 * Stripe trend (docs/11 C2, ref 01): dense 2 px vertical lines forming an area, three per day,
 * interpolated between days. Coloured by band: ≤ free lime-deep, ≤ free+60 butter, above grey (never
 * red). Dashed line at the free allowance. Gaps where no number was entered.
 */
export function StripeTrend(props: {
  points: readonly SeriesPoint[];
  today: ISODate;
  free?: number;
  height?: number;
  label: string;
}) {
  const free = props.free ?? 120;
  const h = props.height ?? 150;
  const W = 600;
  const vals = props.points.map((p) => p.value);
  const max = Math.max(free * 2, ...vals.filter((v): v is number => v != null)) * 1.05;
  const y = (v: number) => h - (v / max) * h;
  const per = 3;
  const n = props.points.length;
  const step = W / (n * per);
  const color = (v: number) => (v <= free ? "#7E9A1E" : v <= free + 60 ? "#C9A227" : "rgb(var(--missed))");

  const lines: { x: number; v: number }[] = [];
  props.points.forEach((p, i) => {
    if (p.value == null) return;
    const next = props.points[i + 1]?.value ?? p.value;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      lines.push({ x: (i * per + k + 0.5) * step, v: p.value + (next - p.value) * t });
    }
  });

  const first = props.points[0]?.date;
  const mid = props.points[Math.floor(n / 2)]?.date;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label={props.label}>
        <line x1="0" x2={W} y1={y(free)} y2={y(free)} stroke="rgb(var(--ink))" strokeWidth="1" strokeDasharray="4 5" opacity="0.5" vectorEffect="non-scaling-stroke" />
        {lines.map((l) => (
          <line
            key={l.x}
            x1={l.x}
            x2={l.x}
            y1={h}
            y2={Math.min(h - 2, y(l.v))}
            stroke={color(l.v)}
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[13px] font-medium text-ink-2">
        <span>{first ? formatDay(first) : ""}</span>
        <span>{mid ? formatDay(mid) : ""}</span>
        <span>{props.points.at(-1)?.date === props.today ? "Today" : props.points.at(-1) ? formatDay(props.points.at(-1)?.date ?? "") : ""}</span>
      </div>
    </figure>
  );
}

export function StripeLegend({ free = 120 }: { free?: number }) {
  return (
    <span className="flex flex-wrap gap-3 text-[13px] text-ink-2" aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-lime-deep" />≤ {free}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-butter-band" />
        {free}–{free + 60}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-missed" />&gt; {free + 60}
      </span>
    </span>
  );
}

/** "Under 120 on 9 of 14 days." */
export function stripeSummary(points: readonly SeriesPoint[], free = 120): string {
  const entered = points.filter((p) => p.value != null);
  if (entered.length === 0) return "No screen minutes entered yet. Add them in the night ritual.";
  const under = entered.filter((p) => (p.value ?? 0) <= free).length;
  return `Under ${free} on ${under} of ${entered.length} ${entered.length === 1 ? "day" : "days"} entered.`;
}
