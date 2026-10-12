import { useState, type FormEvent } from "react";
import type { ForgeProblem, ISODate, Mission } from "@tatakae/core";
import { forge, upsertMission, useIfThenTemplates } from "../lib/hooks";
import { MissionCard } from "./MissionCard";

/** The P1 mission as the charcoal hero card (title at 30 px, Minimum and if-then, lime Start circle). */
export function P1Card(props: { mission: Mission; forged: boolean }) {
  return <MissionCard mission={props.mission} forged={props.forged} prominent />;
}

export const FORGE_PROBLEM_COPY: Record<ForgeProblem, string> = {
  no_p1: "Pick a P1 first.",
  p1_missing_minimum: "P1 needs a Minimum version.",
  p1_missing_if_then: "P1 needs an if-then plan.",
  duplicate_slot: "Two missions share a slot. Keep one per slot.",
  too_many_side: "Keep one side quest.",
};

/** Clickable if-then templates from previous P1 plans. */
export function IfThenTemplates(props: { onPick: (t: string) => void }) {
  const { data: templates = [] } = useIfThenTemplates();
  if (templates.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-sm text-ink-2">From earlier plans</p>
      <ul className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <li key={t}>
            <button type="button" className="chip bg-surface-2 py-2 text-left font-medium hover:bg-line" onClick={() => props.onPick(t)}>
              {t}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Plan only P1 and lock it (Welcome back → Restart, and Today's "No plan locked" state).
 * Title + Minimum + if-then → forge the day.
 */
export function P1QuickPlan(props: { date: ISODate; existing?: Mission; submitLabel?: string; onDone?: () => void }) {
  const ex = props.existing;
  const [title, setTitle] = useState(ex?.title ?? "");
  const [minimum, setMinimum] = useState(ex?.minimum ?? "");
  const [ifThen, setIfThen] = useState(ex?.ifThen ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = title.trim() && minimum.trim() && ifThen.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) {
      setError("P1 needs a title, a Minimum version and an if-then plan.");
      return;
    }
    setBusy(true);
    const fields = { title: title.trim(), minimum: minimum.trim(), ifThen: ifThen.trim() };
    await upsertMission(ex ? { ...ex, ...fields } : { ...fields, slot: "P1", dayDate: props.date });
    const problems = await forge(props.date);
    setBusy(false);
    if (problems.length > 0) {
      setError(problems.map((p) => FORGE_PROBLEM_COPY[p]).join(" "));
      return;
    }
    props.onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3" aria-label="Plan P1">
      <div>
        <label htmlFor="qp-title" className="label">
          P1 — the one mission
        </label>
        <input id="qp-title" className="input" autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="qp-min" className="label">
          Minimum version — the smallest thing that still counts
        </label>
        <input
          id="qp-min"
          className="input"
          maxLength={200}
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          placeholder="e.g. 20 minutes on one problem"
        />
      </div>
      <div>
        <label htmlFor="qp-ifthen" className="label">
          If-then plan
        </label>
        <input
          id="qp-ifthen"
          className="input"
          maxLength={300}
          value={ifThen}
          onChange={(e) => setIfThen(e.target.value)}
          placeholder="If it's 7:00 and I've had tea, then I open the laptop and start"
        />
        <IfThenTemplates onPick={setIfThen} />
      </div>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {props.submitLabel ?? "Lock P1"}
      </button>
    </form>
  );
}
