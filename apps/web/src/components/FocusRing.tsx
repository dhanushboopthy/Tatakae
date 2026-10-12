import type { ReactNode } from "react";

/**
 * Focus countdown ring (docs/11 C11): a thick ring that empties as the block runs, the hero countdown
 * in the middle. Decorative ring (the number carries the meaning), so it is aria-hidden.
 */
export function FocusRing(props: { fraction: number; size?: number; children: ReactNode; paused?: boolean }) {
  const size = props.size ?? 320;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, props.fraction));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={props.paused ? "rgb(var(--missed))" : "#CDE37A"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(f * c).toFixed(1)} ${c.toFixed(1)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-slow ease-out"
        />
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 1} fill="none" stroke="#7E9A1E" strokeWidth="1.5" opacity={f > 0 ? 0.6 : 0} />
      </svg>
      <div className="relative flex flex-col items-center text-center">{props.children}</div>
    </div>
  );
}
