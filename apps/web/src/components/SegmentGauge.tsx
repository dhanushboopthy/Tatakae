import type { WeekMark } from "@tatakae/core";
import { markFill } from "../lib/colors";

/**
 * 12-segment cycle gauge (docs/11 C4, ref 04): one rounded segment per week along a half circle,
 * coloured by that week's mark (lime / lavender / lime-soft / grey for missed / hollow ahead). Centre:
 * big % (days shown up / days counted) and one word. Segments fill one by one only on review screens.
 */
export function SegmentGauge(props: {
  marks: readonly WeekMark[];
  pct: number | null;
  word: string;
  label: string;
  animate?: boolean;
  size?: number;
}) {
  const W = 340;
  const H = 200;
  const cx = W / 2;
  const cy = 172;
  const r = 140;
  const n = Math.max(1, props.marks.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: props.size ?? W }} role="img" aria-label={props.label}>
      {props.marks.map((m, i) => {
        const theta = 180 - ((i + 0.5) * 180) / n;
        const rad = (theta * Math.PI) / 180;
        const px = cx + r * Math.cos(rad);
        const py = cy - r * Math.sin(rad);
        const { fill, stroke } = markFill(m);
        // Position on the <g>: the rise animation sets a CSS transform on the rect, which would
        // otherwise replace the SVG transform attribute and stack every segment at the origin.
        return (
          <g key={i} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(-theta).toFixed(1)})`}>
            <rect
              x={-23}
              y={-14}
              width={46}
              height={28}
              rx={10}
              fill={fill}
              stroke={stroke}
              strokeWidth={m === "Future" || m === "Unplanned" || m === "Missed" || m === "Light" ? 2 : 1.5}
              style={props.animate ? { animation: `rise 220ms cubic-bezier(0.2,0,0,1) ${i * 60}ms both` } : undefined}
            >
              <title>{`Week ${i + 1}: ${m === "Future" ? "ahead" : m === "Unplanned" ? "rest" : m}`}</title>
            </rect>
          </g>
        );
      })}
      <text x={cx} y={cy - 34} textAnchor="middle" fontSize="52" fontWeight="600" fill="rgb(var(--ink))" letterSpacing="-1.5">
        {props.pct == null ? "—" : `${props.pct}%`}
      </text>
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="500" fill="rgb(var(--ink))">
        {props.word}
      </text>
    </svg>
  );
}
