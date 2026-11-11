import { daysBetween, type ISODate, type TrendPoint } from "@tatakae/core";
import { formatDay } from "../lib/format";

/**
 * Weight trend chart (hand-rolled SVG, docs/plans/fitness.md): grey dots for weigh-ins, a lime line for the
 * EMA trend, the latest weigh-in in ink, and an optional dashed goal line (e.g. −1 %/week from a start).
 * The y axis is scaled to kg (padded), unlike Sparkline, which is fixed at 0–100. Weight going up is just
 * a dot; there is no red and no colour-only meaning (dots vs line vs dashes).
 */
export function WeightTrendChart(props: {
  points: readonly TrendPoint[];
  /** Dashed goal line starting at `from` with `fromKg`, falling or rising by `ratePctPerWeek` of that weight. */
  goal?: { from: ISODate; fromKg: number; ratePctPerWeek: number };
  height?: number;
  /** Compact: no axis labels (small cards). */
  compact?: boolean;
  label: string;
  /** Colour of the trend line (a dark card passes a lighter lime). */
  lineColor?: string;
  dotColor?: string;
  /** On a charcoal card: light labels, grid and latest dot. */
  onDark?: boolean;
}) {
  // On the charcoal card the surface itself swaps in dark mode, so use that card's own tokens.
  const muted = props.onDark ? "rgb(var(--on-charcoal-2))" : "rgb(var(--ink-2))";
  const grid = props.onDark ? "rgb(var(--charcoal-line))" : "rgb(var(--line))";
  const latest = props.onDark ? "rgb(var(--on-charcoal))" : "rgb(var(--ink))";
  const W = 600;
  const H = props.height ?? (props.compact ? 56 : 160);
  const padL = props.compact ? 8 : 44;
  const padR = 10;
  const padT = 10;
  const padB = props.compact ? 8 : 24;
  const pts = props.points;
  if (pts.length === 0) {
    return (
      <p className="text-sm text-ink-2" role="img" aria-label={props.label}>
        No weigh-ins yet.
      </p>
    );
  }
  const first = pts[0]!.date;
  const last = pts[pts.length - 1]!.date;
  const span = Math.max(1, daysBetween(first, last));
  const goalEnd = props.goal ? (g: NonNullable<typeof props.goal>) => g.fromKg * (1 + (g.ratePctPerWeek / 100) * (daysBetween(g.from, last) / 7)) : null;
  const values = [
    ...pts.map((p) => p.trendKg),
    ...pts.flatMap((p) => (p.weightKg != null ? [p.weightKg] : [])),
    ...(props.goal && goalEnd ? [props.goal.fromKg, goalEnd(props.goal)] : []),
  ];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.3, (hi - lo) * 0.12);
  const yMin = lo - pad;
  const yMax = hi + pad;
  const x = (d: ISODate) => padL + (daysBetween(first, d) / span) * (W - padL - padR);
  const y = (kg: number) => padT + (1 - (kg - yMin) / (yMax - yMin)) * (H - padT - padB);
  const line = pts.map((p) => `${x(p.date).toFixed(1)},${y(p.trendKg).toFixed(1)}`).join(" ");
  const weighIns = pts.filter((p) => p.weightKg != null);
  const lastWeighIn = weighIns[weighIns.length - 1];
  const lineColor = props.lineColor ?? "#7E9A1E";
  const dotColor = props.dotColor ?? muted;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={props.label} style={{ display: "block", height: "auto" }}>
        {!props.compact && (
          <g fontSize="12" fill={muted} fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>
            {[yMax, (yMax + yMin) / 2, yMin].map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={grid} strokeWidth="1" />
                <text x={padL - 6} y={y(v)} textAnchor="end" dominantBaseline="central">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
          </g>
        )}
        {props.goal && goalEnd && (
          <line
            x1={x(props.goal.from < first ? first : props.goal.from)}
            y1={y(props.goal.fromKg)}
            x2={x(last)}
            y2={y(goalEnd(props.goal))}
            stroke={muted}
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
        )}
        <polyline points={line} fill="none" stroke={lineColor} className={props.onDark ? "stroke-lime dark:stroke-lime-deep" : undefined} strokeWidth={props.compact ? 2.5 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
        {weighIns.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.weightKg as number)} r={props.compact ? 3 : 3.5} fill={p === lastWeighIn ? latest : dotColor} />
        ))}
        {!props.compact && (
          <g fontSize="12" fill={muted} fontFamily="inherit">
            <text x={padL} y={H - 4}>{formatDay(first)}</text>
            <text x={W - padR} y={H - 4} textAnchor="end">{formatDay(last)}</text>
          </g>
        )}
      </svg>
    </figure>
  );
}
