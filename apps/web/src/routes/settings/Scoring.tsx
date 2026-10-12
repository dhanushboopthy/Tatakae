import { useState, type FormEvent } from "react";
import { addDays, canEditScoring, DEFAULT_SCORING, type ScoringSettings as Scoring } from "@tatakae/core";
import { LockIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { formatDay } from "../../lib/format";
import { saveSetting, useSettings, useToday } from "../../lib/hooks";
import { Section } from "./Section";

// Scoring constants (docs/02): editable only on even-ISO-week Sundays (IST), so they can't be tinkered
// with mid-week. The server enforces the same guard.

const FIELDS: readonly { key: keyof Scoring; label: string; hint: string; step?: number }[] = [
  { key: "strongAt", label: "Strong at", hint: "final ≥ this" },
  { key: "solidAt", label: "Solid at", hint: "final ≥ this" },
  { key: "missedExecBelow", label: "Missed day below", hint: "execution %" },
  { key: "screenFreeMin", label: "Free screen minutes", hint: "no penalty up to" },
  { key: "screenStepMin", label: "Penalty step", hint: "minutes per step" },
  { key: "screenStepPenalty", label: "Penalty per step", hint: "points" },
  { key: "screenPenaltyCap", label: "Penalty cap", hint: "points" },
  { key: "comebackBonus", label: "Comeback bonus", hint: "points" },
  { key: "capacityRatio", label: "Capacity line", hint: "share of free time", step: 0.05 },
  { key: "writeOffsPerMonth", label: "Write-offs a month", hint: "days" },
];

function nextEditable(today: string): string {
  for (let i = 0; i < 21; i++) {
    const d = addDays(today, i);
    if (canEditScoring(d)) return d;
  }
  return today;
}

export function ScoringSettings() {
  const { data: s, isPlaceholderData } = useSettings();
  const today = useToday();
  const editable = canEditScoring(today);
  if (!s || isPlaceholderData) return null;
  return (
    <Section
      id="scoring"
      title="Scoring"
      description={
        editable ? (
          "It's an even-week Sunday: you can change the constants today."
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <LockIcon size={14} /> Editable on even-week Sundays. Next: {formatDay(nextEditable(today), { long: true })}.
          </span>
        )
      }
    >
      <ScoringForm key={JSON.stringify(s.scoring)} value={s.scoring} editable={editable} />
    </Section>
  );
}

function ScoringForm({ value, editable }: { value: Scoring; editable: boolean }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<keyof Scoring, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, String(value[f.key])])) as Record<keyof Scoring, string>,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Partial<Scoring> = {};
    for (const f of FIELDS) {
      const n = Number(draft[f.key]);
      if (Number.isFinite(n) && n >= 0) next[f.key] = n;
    }
    await saveSetting("scoring", { ...value, ...next });
    toast("Scoring saved.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`sc-${f.key}`} className="label">
              {f.label} <span className="font-normal">· {f.hint}</span>
            </label>
            <input
              id={`sc-${f.key}`}
              className="input tnum"
              type="number"
              min={0}
              step={f.step ?? 1}
              disabled={!editable}
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(DEFAULT_SCORING[f.key])])) as Record<keyof Scoring, string>)}
          >
            Reset to defaults
          </button>
          <button type="submit" className="btn-primary">
            Save scoring
          </button>
        </div>
      )}
    </form>
  );
}
