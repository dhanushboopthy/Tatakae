import type { HabitCell, HabitGrid } from "@tatakae/core";
import { formatDay } from "../lib/format";

/** Habit heat grid (docs/11 C7): rows = habits, columns = days; lime done, surface-2 not done, hollow rest. */

const CELL: Record<HabitCell, string> = {
  done: "bg-lime shadow-[inset_0_0_0_1.5px_#7E9A1E]",
  not: "bg-surface-2",
  rest: "shadow-[inset_0_0_0_1.5px_rgb(var(--missed))]",
  none: "",
};

export function HabitHeatGrid({ grid }: { grid: HabitGrid }) {
  if (grid.rows.length === 0) return <p className="text-sm text-ink-2">No active habits.</p>;
  const first = grid.dates[0];
  const last = grid.dates.at(-1);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px]">
          <caption className="sr-only">
            Habit checks from {first ? formatDay(first) : ""} to {last ? formatDay(last) : ""}
          </caption>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.habitId}>
                <th scope="row" className="sticky left-0 z-10 bg-surface pr-3 text-left text-sm font-medium">
                  <span className="block max-w-[10rem] truncate">{row.behaviour}</span>
                  <span className="tnum block text-xs font-normal text-ink-2">{row.pct == null ? "—" : `${row.pct}%`}</span>
                </th>
                {row.cells.map((cell, i) => (
                  <td key={grid.dates[i]} className="p-0">
                    <span
                      title={`${formatDay(grid.dates[i] ?? "")}: ${cell === "done" ? "done" : cell === "not" ? "not done" : cell === "rest" ? "rest day" : "not due"}`}
                      className={`block h-3 w-3 rounded-[3px] ${CELL[cell]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-4 text-[13px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${CELL.done}`} /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${CELL.not}`} /> Not done
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${CELL.rest}`} /> Rest day
        </span>
      </p>
    </div>
  );
}
