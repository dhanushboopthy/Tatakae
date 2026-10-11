import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Mission, MissionStatus } from "@tatakae/core";
import { editLocked, needsLockReason, patchMissionFree, setStatus, upsertMission } from "../lib/hooks";
import { FocusIcon, HelpIcon, LockIcon, PencilIcon } from "./icons";
import { LockReasonDialog } from "./LockReasonDialog";
import { StatusChips, STATUS_LABEL } from "./StatusChips";
import { StuckSheet } from "./StuckSheet";
import { useToast } from "./Toast";

/**
 * A mission with one-tap status chips, Start focus, Stuck, resume note and edit.
 * Status / resume note are free fields. Editing title, Minimum, if-then, points or moving it off a
 * locked (forged) day asks for a reason first (LockReasonDialog → mura event).
 */

export const SLOT_LABEL: Record<Mission["slot"], string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  side: "Side quest",
  backlog: "Backlog",
};

type Pending = { patch: Partial<Mission>; summary: string } | null;

export function MissionCard(props: { mission: Mission; forged: boolean; prominent?: boolean }) {
  const { mission: m, forged, prominent = false } = props;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(m.resumeNote ?? "");

  const rescheduled = m.status === "rescheduled";
  const finished = m.status === "done" || m.status === "minimum";

  async function onStatus(s: MissionStatus) {
    await setStatus(m, s);
    if (s === "rescheduled") toast("Moved to your backlog. Pick it up in tonight's ritual.");
  }

  /** Save a patch, asking for a reason when it changes a locked plan. */
  async function save(patch: Partial<Mission>, summary: string): Promise<boolean> {
    const next: Mission = { ...m, ...patch };
    if (needsLockReason(m, next, forged)) {
      setPending({ patch, summary });
      return false;
    }
    await upsertMission(next);
    return true;
  }

  function openNote() {
    setNote(m.resumeNote ?? "");
    setNoteOpen(true);
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    await patchMissionFree(m, { resumeNote: note.trim() || null });
    setNoteOpen(false);
  }

  return (
    <article
      aria-labelledby={`m-${m.id}`}
      className={`card ${prominent ? "border-l-4 border-l-ember p-6" : ""} ${rescheduled ? "opacity-70" : ""}`}
    >
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className={prominent ? "font-semibold text-ember" : "font-medium"}>{SLOT_LABEL[m.slot]}</span>
            {m.slot !== "side" && m.points != null && m.points !== 1 && <span className="tnum">· {m.points} points</span>}
            {m.slot === "side" && <span>· unscored</span>}
            {forged && (
              <span className="inline-flex items-center gap-1">
                · <LockIcon size={14} /> locked
              </span>
            )}
            {m.estMin != null && <span className="tnum">· {m.estMin} min</span>}
          </p>
          <h3 id={`m-${m.id}`} className={prominent ? "mt-1 text-p1" : "mt-1 text-lg font-semibold"}>
            {m.title}
          </h3>
        </div>
        {!editing && (
          <button type="button" className="btn-ghost px-2" aria-label={`Edit ${m.title}`} onClick={() => setEditing(true)}>
            <PencilIcon />
          </button>
        )}
      </header>

      {(m.minimum || m.ifThen) && !editing && (
        <dl className="mt-3 grid gap-1 text-sm">
          {m.minimum && (
            <div className="flex gap-2">
              <dt className="text-muted">Minimum</dt>
              <dd>{m.minimum}</dd>
            </div>
          )}
          {m.ifThen && (
            <div className="flex gap-2">
              <dt className="text-muted">If-then</dt>
              <dd>{m.ifThen}</dd>
            </div>
          )}
        </dl>
      )}

      {editing ? (
        <MissionEditForm
          mission={m}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => {
            if (await save(patch, `Edit ${SLOT_LABEL[m.slot]}: ${m.title}`)) setEditing(false);
          }}
          onBacklog={async () => {
            const ok = await save({ dayDate: null, slot: "backlog", status: "backlog" }, `Move "${m.title}" to the backlog`);
            if (ok) {
              setEditing(false);
              toast("Moved to your backlog.");
            }
          }}
        />
      ) : rescheduled ? (
        <p className="mt-3 text-sm text-muted">{STATUS_LABEL.rescheduled} — a copy waits in your backlog.</p>
      ) : (
        <>
          <div className="mt-4">
            <StatusChips value={m.status} onChange={(s) => void onStatus(s)} label={m.title} />
          </div>

          {noteOpen ? (
            <form onSubmit={saveNote} className="mt-4 flex gap-2">
              <label htmlFor={`note-${m.id}`} className="sr-only">
                Resume note
              </label>
              <input
                id={`note-${m.id}`}
                className="input"
                autoFocus
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Where to pick up next time"
              />
              <button type="submit" className="btn-secondary">
                Save
              </button>
            </form>
          ) : m.resumeNote ? (
            <p className="mt-4 text-sm">
              <span className="text-muted">Resume: </span>
              {m.resumeNote}{" "}
              <button type="button" className="min-h-tap text-muted underline underline-offset-4" onClick={openNote}>
                edit
              </button>
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {!finished && (
              <Link to={`/focus?mission=${encodeURIComponent(m.id)}`} className={prominent ? "btn-primary" : "btn-secondary"}>
                <FocusIcon size={18} /> Start focus
              </Link>
            )}
            {!finished && (
              <button type="button" className="btn-ghost" onClick={() => setStuck(true)}>
                <HelpIcon size={18} /> Stuck
              </button>
            )}
            {!noteOpen && !m.resumeNote && (
              <button type="button" className="btn-ghost" onClick={openNote}>
                Add resume note
              </button>
            )}
          </div>
        </>
      )}

      <StuckSheet mission={m} open={stuck} onClose={() => setStuck(false)} />
      <LockReasonDialog
        open={pending !== null}
        summary={pending?.summary}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending) return;
          await editLocked(m, pending.patch, reason);
          setPending(null);
          setEditing(false);
          toast("Changed. The reason is saved for Sunday.");
        }}
      />
    </article>
  );
}

/** Inline edit form. P1 needs a Minimum and an if-then plan. */
export function MissionEditForm(props: {
  mission: Mission;
  onSave: (patch: Partial<Mission>) => void | Promise<void>;
  onCancel: () => void;
  onBacklog?: () => void | Promise<void>;
}) {
  const m = props.mission;
  const [title, setTitle] = useState(m.title);
  const [minimum, setMinimum] = useState(m.minimum ?? "");
  const [ifThen, setIfThen] = useState(m.ifThen ?? "");
  const [points, setPoints] = useState(m.points ?? 1);
  const [estMin, setEstMin] = useState(m.estMin != null ? String(m.estMin) : "");
  const [error, setError] = useState<string | null>(null);
  const isP1 = m.slot === "P1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    if (isP1 && (!minimum.trim() || !ifThen.trim())) return setError("P1 needs a Minimum and an if-then plan.");
    const est = Number.parseInt(estMin, 10);
    await props.onSave({
      title: title.trim(),
      minimum: minimum.trim() || null,
      ifThen: ifThen.trim() || null,
      points: points === 1 ? null : points,
      estMin: Number.isFinite(est) && est > 0 ? est : null,
    });
  }

  const id = (k: string) => `edit-${m.id}-${k}`;
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label htmlFor={id("title")} className="label">
          Title
        </label>
        <input id={id("title")} className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor={id("min")} className="label">
          Minimum version{isP1 ? "" : " (optional)"}
        </label>
        <input id={id("min")} className="input" maxLength={200} value={minimum} onChange={(e) => setMinimum(e.target.value)} />
      </div>
      <div>
        <label htmlFor={id("ifthen")} className="label">
          If-then plan{isP1 ? "" : " (optional)"}
        </label>
        <input id={id("ifthen")} className="input" maxLength={300} value={ifThen} onChange={(e) => setIfThen(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("points")} className="label">
            Points
          </label>
          <select id={id("points")} className="input" value={points} onChange={(e) => setPoints(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("est")} className="label">
            Estimate (min)
          </label>
          <input
            id={id("est")}
            className="input tnum"
            inputMode="numeric"
            value={estMin}
            onChange={(e) => setEstMin(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        {props.onBacklog ? (
          <button type="button" className="btn-ghost" onClick={() => void props.onBacklog?.()}>
            Move to backlog
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
