import { useState, type FormEvent } from "react";
import type { Habit } from "@tatakae/core";
import { PencilIcon, PlusIcon, TrashIcon } from "../../components/icons";
import { removeHabit, saveHabit, useAllHabits, useAreas } from "../../lib/hooks";
import { Section, Toggle } from "./Section";

const FREQUENCIES = [
  ["daily", "Every day"],
  ["weekdays", "Weekdays"],
  ["weekends", "Weekends"],
] as const;

export function HabitsSettings() {
  const { data: habits = [] } = useAllHabits();
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  return (
    <Section
      id="habits"
      title="Habits"
      description="Tracked, never scored. Anchor each one to something you already do."
      action={
        editing === null && (
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add habit
          </button>
        )
      }
    >
      {editing !== null && <HabitForm habit={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      {habits.length === 0 && editing === null ? (
        <p className="text-sm text-ink-2">No habits yet.</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2">
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${h.active ? "" : "text-ink-2"}`}>{h.behaviour}</p>
                <p className="text-xs text-ink-2">
                  {[h.anchor, h.minimum && `Minimum: ${h.minimum}`, FREQUENCIES.find(([v]) => v === h.frequency)?.[1] ?? h.frequency]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Toggle label={`${h.behaviour} active`} checked={h.active} onChange={(active) => void saveHabit({ ...h, active })} />
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Edit ${h.behaviour}`} onClick={() => setEditing(h)}>
                <PencilIcon size={18} />
              </button>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Delete ${h.behaviour}`} onClick={() => void removeHabit(h.id)}>
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function HabitForm({ habit, onDone }: { habit: Habit | null; onDone: () => void }) {
  const { data: areas = [] } = useAreas();
  const [behaviour, setBehaviour] = useState(habit?.behaviour ?? "");
  const [anchor, setAnchor] = useState(habit?.anchor ?? "");
  const [minimum, setMinimum] = useState(habit?.minimum ?? "");
  const [frequency, setFrequency] = useState(habit?.frequency ?? "daily");
  const [areaId, setAreaId] = useState(habit?.areaId ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!behaviour.trim()) return;
    await saveHabit({
      ...(habit ?? {}),
      behaviour: behaviour.trim(),
      anchor: anchor.trim() || null,
      minimum: minimum.trim() || null,
      frequency,
      areaId: areaId || null,
    });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="card-inner grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="h-behaviour" className="label">
          Habit
        </label>
        <input id="h-behaviour" className="input" autoFocus maxLength={200} value={behaviour} onChange={(e) => setBehaviour(e.target.value)} placeholder="e.g. 10 kana flashcards" />
      </div>
      <div>
        <label htmlFor="h-anchor" className="label">
          After I…
        </label>
        <input id="h-anchor" className="input" maxLength={200} value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="After I brush my teeth" />
      </div>
      <div>
        <label htmlFor="h-min" className="label">
          Minimum
        </label>
        <input id="h-min" className="input" maxLength={200} value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="1 card" />
      </div>
      <div>
        <label htmlFor="h-freq" className="label">
          How often
        </label>
        <select id="h-freq" className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          {FREQUENCIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          {!FREQUENCIES.some(([v]) => v === frequency) && <option value={frequency}>{frequency}</option>}
        </select>
      </div>
      <div>
        <label htmlFor="h-area" className="label">
          Area
        </label>
        <select id="h-area" className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">None</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!behaviour.trim()}>
          Save habit
        </button>
      </div>
    </form>
  );
}
