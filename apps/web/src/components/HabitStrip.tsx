import { Link } from "react-router-dom";
import type { ISODate } from "@tatakae/core";
import { logHabit, useHabits } from "../lib/hooks";
import { CheckIcon } from "./icons";

/** Habits for a date as pills: tap to toggle (lime with ✓ when done). Tracked, never scored. */
export function HabitStrip({ date, title = "Habits", bare = false }: { date: ISODate; title?: string; bare?: boolean }) {
  const { data } = useHabits(date);
  if (!data) return null;
  const doneCount = data.habits.filter((h) => data.done[h.id] === true).length;

  return (
    <section aria-labelledby="habits-title" className={bare ? "" : "card"}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="habits-title" className="text-base font-semibold">
          {title}
        </h2>
        {data.habits.length > 0 && (
          <span className="tnum text-sm text-ink-2">
            {doneCount} / {data.habits.length}
          </span>
        )}
      </div>
      {data.habits.length === 0 ? (
        <p className="text-sm text-ink-2">
          No habits yet.{" "}
          <Link to="/settings#habits" className="link">
            Add one in Settings
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {data.habits.map((h) => {
            const done = data.done[h.id] === true;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => void logHabit(h.id, date, !done)}
                  title={h.minimum ? `Minimum: ${h.minimum}` : undefined}
                  className={`chip ${done ? "bg-lime text-on-accent" : "bg-surface-2 font-medium text-ink-2 hover:bg-line hover:text-ink"}`}
                >
                  {done && <CheckIcon size={16} strokeWidth={2.5} />}
                  {h.behaviour}
                  <span className="sr-only">{done ? "(done)" : "(not yet)"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
