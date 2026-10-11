import { capacityCheck, type ScoringSettings } from "@tatakae/core";
import { InfoIcon } from "./icons";

/**
 * Hara Hachi Bu: planned minutes against free minutes, with a dashed line at 80 % (capacityRatio).
 * Above the line it warns in text — it never blocks. The text summary doubles as the meter label.
 */
export function CapacityBar(props: { plannedMin: number; freeMin: number; scoring: ScoringSettings }) {
  const { plannedMin, freeMin, scoring } = props;
  const { overCapacity, budgetMin } = capacityCheck(plannedMin, freeMin, scoring);
  const pct = (n: number) => (freeMin > 0 ? Math.min(100, (n / freeMin) * 100) : n > 0 ? 100 : 0);
  const line = Math.round(scoring.capacityRatio * 100);
  const summary = `Planned ${plannedMin} min of a ${budgetMin} min budget (${line} % of ${freeMin} free minutes).`;

  return (
    <div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.max(freeMin, plannedMin)}
        aria-valuenow={plannedMin}
        aria-valuetext={summary}
        aria-label="Capacity"
        className="relative h-3 w-full overflow-hidden rounded-full border border-line-strong bg-ink-3"
      >
        <div className="h-full rounded-full bg-ember transition-[width] duration-slow ease-out" style={{ width: `${pct(plannedMin)}%` }} />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 border-l-2 border-dashed border-paper"
          style={{ left: `${line}%` }}
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-4 text-sm">
        <p className="tnum text-muted">{summary}</p>
        <p className="tnum shrink-0 text-muted" aria-hidden="true">
          {line} % line
        </p>
      </div>
      {overCapacity && plannedMin > 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <InfoIcon size={18} className="shrink-0 text-ember" />
          Over {line} % of your free time. Fine if you mean it — or drop one.
        </p>
      )}
    </div>
  );
}
