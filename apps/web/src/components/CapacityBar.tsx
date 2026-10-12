import { capacityCheck, type ScoringSettings } from "@tatakae/core";
import { InfoIcon } from "./icons";

/**
 * Hara Hachi Bu (docs/11 C10): planned minutes against free minutes on a thick pill track, lime fill,
 * a tick at 80 % (capacityRatio). Above the tick the fill turns butter and a line of text warns — it
 * never blocks. The text summary doubles as the meter label.
 */
export function CapacityBar(props: { plannedMin: number; freeMin: number; scoring: ScoringSettings }) {
  const { plannedMin, freeMin, scoring } = props;
  const { overCapacity, budgetMin } = capacityCheck(plannedMin, freeMin, scoring);
  const pct = (n: number) => (freeMin > 0 ? Math.min(100, (n / freeMin) * 100) : n > 0 ? 100 : 0);
  const line = Math.round(scoring.capacityRatio * 100);
  const summary = `Planned ${plannedMin} min of a ${budgetMin} min budget (${line} % of ${freeMin} free minutes).`;
  const warn = overCapacity && plannedMin > 0;

  return (
    <div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.max(freeMin, plannedMin)}
        aria-valuenow={plannedMin}
        aria-valuetext={summary}
        aria-label="Capacity"
        className="relative h-6 w-full rounded-full bg-surface-2"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-slow ease-out ${warn ? "bg-area-butter" : "bg-lime"}`}
          style={{ width: `${pct(plannedMin)}%`, boxShadow: `inset 0 0 0 1.5px ${warn ? "#B38F12" : "#7E9A1E"}` }}
        />
        <div aria-hidden="true" className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `${line}%` }} />
      </div>
      <div className="mt-2 flex items-start justify-between gap-4 text-sm">
        <p className="tnum text-ink-2">{summary}</p>
        <p className="tnum shrink-0 text-ink-2" aria-hidden="true">
          {line} % tick
        </p>
      </div>
      {warn && (
        <p className="mt-2 flex items-center gap-2 text-sm font-medium">
          <InfoIcon size={18} className="shrink-0" />
          Over {line} % of your free time. Fine if you mean it — or drop one.
        </p>
      )}
    </div>
  );
}
