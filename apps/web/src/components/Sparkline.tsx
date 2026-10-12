import type { SeriesPoint } from "@tatakae/core";

/**
 * Sparkline + 7-day average (docs/11 C3): final score per day as a thin ink line (gaps where no
 * score), the rolling 7-day average as a lime-deep line with a lime-soft area under it. 0–100 scale.
 */
export function Sparkline(props: { points: readonly SeriesPoint[]; avg7: readonly SeriesPoint[]; height?: number; label: string }) {
  const h = props.height ?? 120;
  const W = 600;
  const n = Math.max(1, props.points.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => h - 4 - (v / 100) * (h - 8);

  const segments = (pts: readonly SeriesPoint[]) => {
    const out: string[] = [];
    let cur: string[] = [];
    pts.forEach((p, i) => {
      if (p.value == null) {
        if (cur.length) out.push(cur.join(" "));
        cur = [];
      } else cur.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    });
    if (cur.length) out.push(cur.join(" "));
    return out;
  };

  const avgPts = props.avg7.map((p, i) => (p.value == null ? null : ([x(i), y(p.value)] as const))).filter((p) => p !== null);
  const area =
    avgPts.length > 1
      ? `M${avgPts[0]?.[0]},${h} ${avgPts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ")} L${avgPts.at(-1)?.[0]},${h} Z`
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label={props.label}>
      {[50, 80].map((t) => (
        <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {area && <path d={area} fill="rgb(var(--lime-soft))" />}
      {segments(props.avg7).map((s) => (
        <polyline key={`a${s}`} points={s} fill="none" stroke="#7E9A1E" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      ))}
      {segments(props.points).map((s) => (
        <polyline key={`p${s}`} points={s} fill="none" stroke="rgb(var(--ink))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
