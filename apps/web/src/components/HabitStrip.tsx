import { Link } from "react-router-dom";
import type { ISODate } from "@tatakae/core";
import { logHabit, useHabits } from "../lib/hooks";
import { CheckIcon } from "./icons";

/** Habits for a date: one-tap toggles. Tracked, never scored. */
export function HabitStrip({ date }: { date: ISODate }) {
  const { data } = useHabits(date);
  if (!data) return null;

  return (
    <section aria-labelledby="habits-title">
      <h2 id="habits-title" className="mb-2">
        Habits
      </h2>
      {data.habits.length === 0 ? (
        <p className="text-sm text-muted">
          No habits yet. <Link to="/settings#habits" className="underline underline-offset-4">Add one in Settings</Link>.
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
                  className={`inline-flex min-h-tap items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-base ease-out ${
                    done ? "border-paper bg-jade-soft" : "border-line-strong hover:bg-ink-3"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? "border-jade bg-jade text-ink" : "border-line-strong"}`}
                  >
                    {done && <CheckIcon size={14} strokeWidth={2.5} />}
                  </span>
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
