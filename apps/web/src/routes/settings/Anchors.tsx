import { useState, type FormEvent } from "react";
import type { Anchor } from "@tatakae/core";
import { PencilIcon, PlusIcon, TrashIcon } from "../../components/icons";
import { removeAnchor, saveAnchor, useAnchors } from "../../lib/hooks";
import { Section } from "./Section";

const DAYS = [
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
  ["0", "Sun"],
] as const;

const daysLabel = (weekdays: string) =>
  weekdays.trim() === ""
    ? "Every day"
    : DAYS.filter(([v]) => weekdays.split(",").includes(v))
        .map(([, l]) => l)
        .join(" ");

export function AnchorsSettings() {
  const { data: anchors = [] } = useAnchors();
  const [editing, setEditing] = useState<Anchor | "new" | null>(null);
  return (
    <Section
      id="anchors"
      title="Anchors"
      description="Fixed blocks (classes, internship, gym). The ritual subtracts them from tomorrow's free time; the week planner shows them grey."
      action={
        editing === null && (
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add anchor
          </button>
        )
      }
    >
      {editing !== null && <AnchorForm anchor={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      {anchors.length === 0 && editing === null ? (
        <p className="text-sm text-ink-2">No anchors yet.</p>
      ) : (
        <ul className="space-y-2">
          {anchors.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-ink-2">{daysLabel(a.weekdays)}</p>
              </div>
              <span className="tnum rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-on-charcoal">
                {a.startTime}–{a.endTime}
              </span>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>
                <PencilIcon size={18} />
              </button>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Delete ${a.name}`} onClick={() => void removeAnchor(a.id)}>
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AnchorForm({ anchor, onDone }: { anchor: Anchor | null; onDone: () => void }) {
  const [name, setName] = useState(anchor?.name ?? "");
  const [startTime, setStart] = useState(anchor?.startTime ?? "09:00");
  const [endTime, setEnd] = useState(anchor?.endTime ?? "17:00");
  const [days, setDays] = useState<string[]>(anchor ? anchor.weekdays.split(",").filter(Boolean) : ["1", "2", "3", "4", "5"]);
  const ok = name.trim() && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const weekdays = DAYS.map(([v]) => v).filter((v) => days.includes(v)).join(",");
    await saveAnchor({ id: anchor?.id, name: name.trim(), startTime, endTime, weekdays });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="card-inner space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="a-name" className="label">
            Name
          </label>
          <input id="a-name" className="input" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Internship" />
        </div>
        <div>
          <label htmlFor="a-start" className="label">
            From
          </label>
          <input id="a-start" type="time" className="input tnum" value={startTime} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="a-end" className="label">
            To
          </label>
          <input id="a-end" type="time" className="input tnum" value={endTime} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <fieldset>
        <legend className="label">Days (none = every day)</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(([v, l]) => {
            const on = days.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((d) => (on ? d.filter((x) => x !== v) : [...d, v]))}
                className={`chip min-w-[56px] justify-center ${on ? "bg-lime text-on-accent" : "bg-surface font-medium"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!ok}>
          Save anchor
        </button>
      </div>
    </form>
  );
}
