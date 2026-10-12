/** Ring progress (docs/11 C5): 56 ring, 6 stroke, number in the centre, coloured by the area's deep tone. */
export function RingProgress(props: { pct: number; color?: string; size?: number; stroke?: number; label: string }) {
  const size = props.size ?? 56;
  const stroke = props.stroke ?? 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Math.round(props.pct)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={props.label} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
      {p > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={props.color ?? "#7E9A1E"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${((p / 100) * c).toFixed(1)} ${c.toFixed(1)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.27}
        fontWeight="600"
        fill="rgb(var(--ink))"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {p}
      </text>
    </svg>
  );
}
