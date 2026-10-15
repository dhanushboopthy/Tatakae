import { weekdayOf, type ISODate } from "@tatakae/core";

/**
 * Calories by day (hand-rolled SVG, design canvas "Fitness · Week"): one rounded bar per day, lime at or under
 * that day's target and butter above it (never red), a dashed grey line for maintenance and a dashed lime
 * line for the target. The number sits above each bar, so colour never carries the meaning alone.
 */

export interface KcalDay {
  date: ISODate;
  kcal: number | null;
  target: number;
  maintenance: number;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TONES = {
  under: { fill: "#CDE37A", deep: "#7E9A1E" },
  over: { fill: "#F4D978", deep: "#A88A1C" },
} as const;

export function DailyKcalBars(props: { days: readonly KcalDay[]; label: string; height?: number }) {
  const W = 640;
  const H = props.height ?? 260;
  const padL = 44;
  const padR = 8;
  const top = 24;
  const base = H - 40;
  const peak = Math.max(...props.days.flatMap((d) => [d.kcal ?? 0, d.maintenance, d.target]), 1000);
  const max = Math.ceil((peak * 1.1) / 1000) * 1000;
  const y = (v: number) => base - (v / max) * (base - top);
  const slot = (W - padL - padR) / Math.max(1, props.days.length);
  const barW = Math.min(40, slot * 0.5);
  const cx = (i: number) => padL + slot * (i + 0.5);
  const ticks = Array.from({ length: max / 1000 + 1 }, (_, i) => i * 1000);
  const maintenance = props.days[props.days.length - 1]?.maintenance ?? 0;
  const targetLine = props.days.map((d, i) => `${cx(i).toFixed(1)},${y(d.target).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={props.label} style={{ display: "block", height: "auto" }}>
      <g fontSize="11" fill="rgb(var(--ink-2))" fontFamily="inherit">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end">
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          </g>
        ))}
      </g>
      {props.days.map((d, i) => {
        if (d.kcal == null) return null;
        const tone = d.kcal <= d.target ? TONES.under : TONES.over;
        const top2 = y(d.kcal);
        return (
          <g key={d.date}>
            <rect x={cx(i) - barW / 2} y={top2} width={barW} height={base - top2} rx={10} fill={tone.fill} stroke={tone.deep} strokeWidth="1.5" />
            <text x={cx(i)} y={top2 - 7} textAnchor="middle" fontSize="12" fontWeight="600" fill="rgb(var(--ink))" style={{ fontVariantNumeric: "tabular-nums" }}>
              {d.kcal.toLocaleString("en-US")}
            </text>
          </g>
        );
      })}
      <polyline points={targetLine} fill="none" stroke="#7E9A1E" strokeWidth="1.5" strokeDasharray="6 5" />
      {maintenance > 0 && (
        <>
          <line x1={padL} x2={W - padR} y1={y(maintenance)} y2={y(maintenance)} stroke="rgb(var(--ink-2))" strokeWidth="1.5" strokeDasharray="6 5" />
          <text x={W - padR} y={y(maintenance) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="rgb(var(--ink-2))">
            Maintenance {maintenance.toLocaleString("en-US")}
          </text>
        </>
      )}
      <g fontSize="12" fontWeight="500" fill="rgb(var(--ink-2))" textAnchor="middle">
        {props.days.map((d, i) => (
          <text key={d.date} x={cx(i)} y={H - 16}>
            {WEEKDAY[weekdayOf(d.date)]}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Legend with a swatch shape per item (not colour alone). */
export function KcalLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: TONES.under.fill, boxShadow: `inset 0 0 0 1.5px ${TONES.under.deep}` }} />
        On target
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: TONES.over.fill, boxShadow: `inset 0 0 0 1.5px ${TONES.over.deep}` }} />
        Above target
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed border-ink-2" />
        Maintenance
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed" style={{ borderColor: "#7E9A1E" }} />
        Target
      </span>
    </div>
  );
}
