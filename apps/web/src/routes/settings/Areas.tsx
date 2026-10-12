import { useState, type FormEvent } from "react";
import type { Area } from "@tatakae/core";
import { NamedIcon, PencilIcon, PlusIcon, TrashIcon } from "../../components/icons";
import { AREA_COLORS, AREA_COLOR_KEYS, areaColor, type AreaColorKey } from "../../lib/colors";
import { removeArea, saveArea, useAreas } from "../../lib/hooks";
import { Section } from "./Section";

const ICON_CHOICES = ["Server", "Dumbbell", "Languages", "Briefcase", "NotebookPen", "Target", "Sparkles", "Repeat", "Timer", "Coffee"] as const;

export function AreasSettings() {
  const { data: areas = [] } = useAreas();
  const [editing, setEditing] = useState<Area | "new" | null>(null);
  return (
    <Section
      id="areas"
      title="Areas"
      description="Life areas with a why (Ikigai). Their colour tints week-planner blocks, focus charts and goal rings."
      action={
        editing === null && (
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add area
          </button>
        )
      }
    >
      {editing !== null && <AreaForm area={editing === "new" ? null : editing} index={areas.length} onDone={() => setEditing(null)} />}
      {areas.length === 0 && editing === null ? (
        <p className="text-sm text-ink-2">No areas yet. Try Career, Health, Japanese, Freelance.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {areas.map((a, i) => {
            const c = areaColor(a, i);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-card-inner p-3 pl-4 text-on-accent" style={{ background: c.fill }}>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60" aria-hidden="true">
                  <NamedIcon icon={a.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.name}</p>
                  {a.why && <p className="truncate text-xs">{a.why}</p>}
                </div>
                {a.alignmentScore != null && (
                  <span className="tnum rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold" title="Alignment">
                    {a.alignmentScore}/10
                  </span>
                )}
                <button type="button" className="icon-btn-sm bg-white/60 hover:bg-white" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>
                  <PencilIcon size={18} />
                </button>
                <button type="button" className="icon-btn-sm bg-white/60 hover:bg-white" aria-label={`Delete ${a.name}`} onClick={() => void removeArea(a.id)}>
                  <TrashIcon size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function AreaForm({ area, index, onDone }: { area: Area | null; index: number; onDone: () => void }) {
  const [name, setName] = useState(area?.name ?? "");
  const [why, setWhy] = useState(area?.why ?? "");
  const [standard, setStandard] = useState(area?.standard ?? "");
  const [color, setColor] = useState<AreaColorKey>(
    (area?.color && area.color in AREA_COLORS ? area.color : AREA_COLOR_KEYS[index % 4]) as AreaColorKey,
  );
  const [icon, setIcon] = useState<string>(area?.icon ?? "Target");
  const [align, setAlign] = useState(area?.alignmentScore != null ? String(area.alignmentScore) : "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const n = Number.parseInt(align, 10);
    await saveArea({
      ...(area ?? {}),
      name,
      why: why.trim() || null,
      standard: standard.trim() || null,
      color,
      icon,
      alignmentScore: Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null,
    });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="card-inner grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="ar-name" className="label">
          Name
        </label>
        <input id="ar-name" className="input" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="ar-align" className="label">
          Alignment (0–10, monthly)
        </label>
        <input id="ar-align" className="input tnum" inputMode="numeric" value={align} onChange={(e) => setAlign(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ar-why" className="label">
          Why it matters
        </label>
        <input id="ar-why" className="input" maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ar-std" className="label">
          Standard (what "good enough" looks like)
        </label>
        <input id="ar-std" className="input" maxLength={300} value={standard} onChange={(e) => setStandard(e.target.value)} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_COLOR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={color === k}
              aria-label={AREA_COLORS[k].label}
              onClick={() => setColor(k)}
              className={`h-11 w-11 rounded-full ${color === k ? "outline outline-2 outline-offset-2 outline-ink" : ""}`}
              style={{ background: AREA_COLORS[k].fill, boxShadow: `inset 0 0 0 1.5px ${AREA_COLORS[k].deep}` }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="label">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {ICON_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={icon === n}
              aria-label={n}
              onClick={() => setIcon(n)}
              className={`icon-btn-sm ${icon === n ? "bg-charcoal text-on-charcoal hover:bg-charcoal" : "bg-surface"}`}
            >
              <NamedIcon icon={n} size={18} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          Save area
        </button>
      </div>
    </form>
  );
}
