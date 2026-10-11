import { useDaysShownUp } from "../lib/hooks";

/** Cumulative "days shown up" — a count that never resets (no streaks). */
export function DaysShownUp() {
  const { data } = useDaysShownUp();
  if (!data) return null;
  return (
    <p className="text-sm text-muted">
      <span className="tnum text-base font-semibold text-paper">{data.count}</span> {data.count === 1 ? "day" : "days"} shown up
      <span className="sr-only">. This count never resets.</span>
    </p>
  );
}
