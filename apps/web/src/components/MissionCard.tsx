import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { RANKED_SLOTS, type FocusLength, type Mission, type MissionStatus, type RankedSlot } from "@tatakae/core";
import { editLocked, needsLockReason, patchMissionFree, setStatus, upsertMission, useSettings } from "../lib/hooks";
import { EditedElsewhere } from "./ConflictNotice";
import { ArrowRightIcon, FocusIcon, LockIcon, PencilIcon, StuckIcon } from "./icons";
import { LockReasonDialog } from "./LockReasonDialog";
import { StatusChips, STATUS_LABEL } from "./StatusChips";
import { StuckSheet } from "./StuckSheet";
import { useToast } from "./Toast";

/**
 * A mission card (docs/10 §5): P1 = charcoal hero with a lime Start circle and 25 · 50 · 90 pills;
 * P2 = lavender, P3 = lime-soft, P4–P9 = plain surface with an ink rank pill, side quest = surface-2.
 * Ink text on every coloured fill.
 * One-tap status chips, Start focus, Stuck, resume note and edit. Status / resume note are free fields;
 * editing title, Minimum, if-then, points or moving it off a locked (forged) day asks for a reason
 * first (LockReasonDialog → mura event).
 */

export const SLOT_LABEL: Record<Mission["slot"], string> = {
  ...(Object.fromEntries(RANKED_SLOTS.map((s) => [s, s])) as Record<RankedSlot, string>),
  side: "Side quest",
  backlog: "Backlog",
};

interface Tone {
  card: string;
  sub: string;
  action: string;
  pill: string;
  outline: string;
  onColor: boolean;
}

/** P4–P9: white card, ink rank pill (the top three keep their colours). */
const LOWER: Tone = {
  card: "bg-surface text-ink",
  sub: "text-ink-2",
  action: "bg-surface-2 text-ink hover:bg-line",
  pill: "bg-ink text-surface",
  outline: "border-ink text-ink",
  onColor: false,
};

const TONE: Record<Mission["slot"], Tone> = {
  P4: LOWER,
  P5: LOWER,
  P6: LOWER,
  P7: LOWER,
  P8: LOWER,
  P9: LOWER,
  P1: {
    card: "bg-charcoal text-on-charcoal",
    sub: "text-on-charcoal-2",
    action: "bg-on-charcoal/10 text-on-charcoal hover:bg-on-charcoal/20",
    pill: "bg-lime text-on-accent",
    outline: "border-charcoal-line text-on-charcoal-2",
    onColor: true,
  },
  P2: {
    card: "bg-lavender text-on-accent",
    sub: "text-on-accent/80",
    action: "bg-white/60 text-on-accent hover:bg-white/80",
    pill: "bg-on-accent text-white",
    outline: "border-on-accent text-on-accent",
    onColor: true,
  },
  P3: {
    card: "bg-lime-soft text-ink",
    sub: "text-ink-2",
    action: "bg-surface text-ink hover:bg-surface/70",
    pill: "bg-ink text-surface",
    outline: "border-ink text-ink",
    onColor: false,
  },
  side: {
    card: "bg-surface-2 text-ink",
    sub: "text-ink-2",
    action: "bg-surface text-ink hover:bg-line",
    pill: "bg-surface text-ink",
    outline: "border-missed text-ink-2",
    onColor: false,
  },
  backlog: {
    card: "bg-surface text-ink",
    sub: "text-ink-2",
    action: "bg-surface-2 text-ink hover:bg-line",
    pill: "bg-surface-2 text-ink",
    outline: "border-missed text-ink-2",
    onColor: false,
  },
};

const LENGTHS: readonly FocusLength[] = [25, 50, 90];

type Pending = { patch: Partial<Mission>; summary: string } | null;

export function MissionCard(props: { mission: Mission; forged: boolean; prominent?: boolean; compact?: boolean }) {
  const { mission: m, forged } = props;
  const tone = TONE[m.slot];
  const hero = m.slot === "P1" || props.prominent === true;
  const navigate = useNavigate();
  const toast = useToast();
  const { data: settings } = useSettings();
  const [length, setLength] = useState<FocusLength | null>(null);
  const [editing, setEditing] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(m.resumeNote ?? "");

  const rescheduled = m.status === "rescheduled";
  const finished = m.status === "done" || m.status === "minimum";
  const chosen = length ?? settings?.focus_default ?? 50;

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

  const startFocus = (min: number) => navigate(`/focus?mission=${encodeURIComponent(m.id)}&min=${min}`);

  return (
    <article
      aria-labelledby={`m-${m.id}`}
      className={`flex flex-col rounded-card ${hero ? "gap-5 p-7" : "gap-4 p-6"} ${tone.card} ${rescheduled ? "opacity-70" : ""}`}
    >
      <header className="flex items-start gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 text-[13px]">
          <span className={`pill ${tone.pill}`}>{SLOT_LABEL[m.slot]}</span>
          {m.estMin != null && <span className={`pill-outline tnum ${tone.outline}`}>{m.estMin} min</span>}
          {m.slot !== "side" && m.points != null && m.points !== 1 && <span className={`tnum ${tone.sub}`}>{m.points} points</span>}
          {m.slot === "side" && <span className={tone.sub}>Unscored</span>}
          {forged && (
            <span className={`inline-flex items-center gap-1 ${tone.sub}`}>
              <LockIcon size={14} /> Locked
            </span>
          )}
          <EditedElsewhere table="missions" pk={m.id} className={tone.sub} />
        </div>
        {!editing && (
          <button
            type="button"
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${tone.action}`}
            aria-label={`Edit ${m.title}`}
            onClick={() => setEditing(true)}
          >
            <PencilIcon size={18} />
          </button>
        )}
      </header>

      <div>
        <h3 id={`m-${m.id}`} className={hero ? "text-p1" : "text-xl font-semibold leading-snug"}>
          {m.title}
        </h3>
        {(m.minimum || m.ifThen) && !editing && (
          <dl className={`mt-3 grid gap-1 text-sm ${tone.sub}`}>
            {m.minimum && (
              <div className="flex gap-1.5">
                <dt className="font-semibold">Minimum ·</dt>
                <dd>{m.minimum}</dd>
              </div>
            )}
            {m.ifThen && (
              <div className="flex gap-1.5">
                <dt className="font-semibold">If-then ·</dt>
                <dd>{m.ifThen}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {editing ? (
        <div className="rounded-card-inner bg-surface p-4 text-ink">
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
        </div>
      ) : rescheduled ? (
        <p className={`text-sm ${tone.sub}`}>{STATUS_LABEL.rescheduled} — a copy waits in your backlog.</p>
      ) : (
        <>
          <StatusChips value={m.status} onChange={(s) => void onStatus(s)} label={m.title} onColor={tone.onColor} />

          {noteOpen ? (
            <form onSubmit={saveNote} className="flex gap-2">
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
              <button type="submit" className="btn-primary">
                Save
              </button>
            </form>
          ) : m.resumeNote ? (
            <p className="text-sm">
              <span className={`font-semibold ${tone.sub}`}>Resume · </span>
              {m.resumeNote}{" "}
              <button type="button" className={`min-h-tap font-semibold underline underline-offset-4 ${tone.sub}`} onClick={openNote}>
                edit
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {!finished && hero && (
              <>
                <span className={`mr-1 text-sm ${tone.sub}`} id={`len-${m.id}`}>
                  Start focus
                </span>
                <div role="radiogroup" aria-labelledby={`len-${m.id}`} className="flex gap-1.5">
                  {LENGTHS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={chosen === n}
                      onClick={() => setLength(n)}
                      className={`tnum inline-flex h-11 min-w-[48px] items-center justify-center rounded-full border px-3 text-sm font-semibold transition ${
                        chosen === n ? "border-transparent bg-on-charcoal text-charcoal" : tone.outline
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!finished && !hero && (
              <button type="button" className={`btn min-h-tap ${tone.action}`} onClick={() => startFocus(chosen)}>
                <FocusIcon size={18} /> Start focus
              </button>
            )}
            {!finished && (
              <button type="button" className={`btn min-h-tap font-medium ${tone.action}`} onClick={() => setStuck(true)}>
                <StuckIcon size={18} /> Stuck
              </button>
            )}
            {!noteOpen && !m.resumeNote && (
              <button type="button" className={`btn min-h-tap font-medium ${tone.action}`} onClick={openNote}>
                Resume note
              </button>
            )}
            {!finished && hero && (
              <button
                type="button"
                onClick={() => startFocus(chosen)}
                className="ml-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-lime text-on-accent transition hover:brightness-95 active:scale-[0.96]"
                aria-label={`Start ${chosen}-minute focus on ${m.title}`}
              >
                <ArrowRightIcon size={26} strokeWidth={2} />
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
    <form onSubmit={onSubmit} className="space-y-3">
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
        <p role="alert" className="text-sm font-medium">
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
