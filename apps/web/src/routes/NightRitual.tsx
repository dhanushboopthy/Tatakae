import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  DEFAULT_RANKED,
  MAX_RANKED,
  RANKED_SLOTS,
  RITUAL_RESTART,
  addDays,
  type Anchor,
  type ISODate,
  type Mission,
  type RankedSlot,
  type ResolvedSettings,
} from "@tatakae/core";
import { CapacityBar } from "../components/CapacityBar";
import { MoonIcon, PlusIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { Modal } from "../components/Modal";
import { FORGE_PROBLEM_COPY, IfThenTemplates } from "../components/P1Card";
import { StatusChips } from "../components/StatusChips";
import { useToast } from "../components/Toast";
import {
  deleteMission,
  forge,
  patchMissionFree,
  setStatus,
  toBacklog,
  updateDay,
  upsertMission,
  useAnchors,
  useBacklog,
  useDay,
  useSettings,
  useToday,
  type DayView,
} from "../lib/hooks";
import { AFTER_P1, anchorsFor, freeMinutes, plannedMinutes } from "../lib/plan";
import { api, ApiError, isNetworkError } from "../lib/api";
import { flushNow } from "../sync/engine";
import { storage } from "../lib/storage";
import { useForcedDark } from "../lib/theme";

// Night ritual (laptop, ≤ 5 min): 8 steps per docs/02-method.md + docs/05-ui-ux.md.
// Progress dots, Enter advances, every step autosaves to the local store, and the current step is
// remembered (localStorage, per day) so an interrupted ritual resumes where it stopped.

const STEPS = [
  "Close today",
  "Small win",
  "Three questions",
  "Close loops",
  "Capacity",
  "Pick missions",
  "Side quest",
  "Shutdown",
] as const;

interface RitualState {
  step: number;
  reached: number;
  freeMin: number | null;
}

const stateKey = (date: ISODate) => `tatakae.ritual.${date}`;

function useRitualState(date: ISODate): [RitualState, (patch: Partial<RitualState>) => void] {
  const [state, setState] = useState<RitualState>(() => storage.getJson(stateKey(date), { step: 0, reached: 0, freeMin: null }));
  useEffect(() => {
    setState(storage.getJson(stateKey(date), { step: 0, reached: 0, freeMin: null }));
  }, [date]);
  const update = (patch: Partial<RitualState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      next.step = Math.max(0, Math.min(STEPS.length - 1, next.step));
      next.reached = Math.max(next.reached, next.step);
      storage.setJson(stateKey(date), next);
      return next;
    });
  return [state, update];
}

export function NightRitual() {
  useForcedDark(); // the night ritual always uses the dark variant (docs/10 §2)
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const todayQ = useDay(today);
  const tomorrowQ = useDay(tomorrow);
  const settings = useSettings().data;
  const anchors = useAnchors().data;
  const [state, update] = useRitualState(today);
  const [justForged, setJustForged] = useState(false);

  if (!todayQ.data || !tomorrowQ.data || !settings || !anchors) {
    return <p className="text-ink-2">Opening the ritual…</p>;
  }

  if (tomorrowQ.data.forged) {
    return (
      <ShutdownComplete
        fresh={justForged}
        date={tomorrow}
        onRestarted={() => {
          update({ step: 0, reached: 0, freeMin: null });
          setJustForged(false);
        }}
      />
    );
  }

  const next = () => update({ step: state.step + 1 });
  const back = () => update({ step: state.step - 1 });
  const step = state.step;

  return (
    <div className="mx-auto max-w-read">
      <div className="card p-6 md:p-8">
        <header className="mb-8">
          <p className="eyebrow">Night ritual · about five minutes</p>
          <ProgressDots step={step} reached={state.reached} onGo={(i) => update({ step: i })} />
        </header>

        {step === 0 && <CloseToday day={todayQ.data} onNext={next} />}
        {step === 1 && <SmallWin day={todayQ.data} onNext={next} onBack={back} />}
        {step === 2 && <Questions day={todayQ.data} onNext={next} onBack={back} />}
        {step === 3 && <CloseLoops day={todayQ.data} onNext={next} onBack={back} />}
        {step === 4 && (
          <Capacity
            tomorrow={tomorrowQ.data}
            anchors={anchorsFor(anchors, tomorrow)}
            settings={settings}
            freeMin={state.freeMin}
            onNext={(freeMin) => update({ freeMin, step: step + 1 })}
            onBack={back}
          />
        )}
        {step === 5 && (
          <PickThree
            tomorrow={tomorrowQ.data}
            settings={settings}
            freeMin={state.freeMin ?? defaultFree(settings, anchorsFor(anchors, tomorrow))}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 6 && <SideQuest tomorrow={tomorrowQ.data} onNext={next} onBack={back} />}
        {step === 7 && (
          <Shutdown
            tomorrow={tomorrowQ.data}
            onBack={back}
            onFixPlan={() => update({ step: 5 })}
            onForged={() => setJustForged(true)}
          />
        )}
      </div>
    </div>
  );
}

function defaultFree(settings: ResolvedSettings, anchors: readonly Anchor[]): number {
  return freeMinutes({ wakeTime: settings.wake_time, ritualTime: settings.ritual_time, anchors });
}

// ---------- chrome ----------

function ProgressDots(props: { step: number; reached: number; onGo: (i: number) => void }) {
  return (
    <div className="mt-3">
      {/* Phones: eight 44 px jump buttons don't fit, so the dots are a passive bar there; Back/Next move between steps. */}
      <p className="flex min-h-tap items-center gap-2 sm:hidden" aria-hidden="true">
        {STEPS.map((name, i) => (
          <span
            key={name}
            className={`block h-2.5 rounded-full ${i === props.step ? "w-8 bg-lime" : i < props.step || i <= props.reached ? "w-2.5 bg-ink" : "w-2.5 border border-missed"}`}
          />
        ))}
      </p>
      <ol className="hidden items-center gap-1 sm:flex" aria-label="Ritual progress">
        {STEPS.map((name, i) => {
          const current = i === props.step;
          const done = i < props.step || i <= props.reached;
          return (
            <li key={name}>
              <button
                type="button"
                disabled={i > props.reached}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${name}${current ? " (current)" : ""}`}
                onClick={() => props.onGo(i)}
                className="flex min-h-tap min-w-tap items-center justify-center disabled:cursor-default"
              >
                <span
                  aria-hidden="true"
                  className={`block h-2.5 rounded-full transition-all duration-base ease-out ${
                    current ? "w-8 bg-lime" : done ? "w-2.5 bg-ink" : "w-2.5 border border-missed"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <h1 className="mt-3" aria-live="polite">
        <span className="tnum text-ink-2">{props.step + 1}/8 · </span>
        {STEPS[props.step]}
      </h1>
    </div>
  );
}

function StepForm(props: {
  onSubmit: () => void | Promise<void>;
  onBack?: () => void;
  children: ReactNode;
  nextLabel?: string;
  extra?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await props.onSubmit();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      {props.children}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
        {props.onBack ? (
          <button type="button" className="btn-ghost" onClick={props.onBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {props.extra}
          <button type="submit" className="btn-accent" disabled={busy}>
            {props.nextLabel ?? "Next"} <span className="rounded-md border border-on-accent/30 px-1.5 text-xs font-medium">Enter</span>
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------- 1. close today ----------

function CloseToday({ day, onNext }: { day: DayView; onNext: () => void }) {
  const [screen, setScreen] = useState(day.day?.screenMin != null ? String(day.day.screenMin) : "");
  const missions = day.missions.filter((m) => m.status !== "rescheduled");
  return (
    <StepForm
      onSubmit={async () => {
        const n = Number.parseInt(screen, 10);
        await updateDay(day.date, { screenMin: Number.isFinite(n) ? Math.min(1440, Math.max(0, n)) : null });
        onNext();
      }}
    >
      {missions.length === 0 ? (
        <p className="text-ink-2">Nothing was planned today. That's fine — tomorrow starts tonight.</p>
      ) : (
        <ul className="space-y-3">
          {missions.map((m) => (
            <li key={m.id} className="card-inner">
              <p className="mb-3">
                <span className="pill mr-2 bg-surface text-ink">{m.slot === "side" ? "Side quest" : m.slot}</span>
                <span className="font-medium">{m.title}</span>
              </p>
              <StatusChips value={m.status} onChange={(s) => void setStatus(m, s)} label={m.title} onMuted />
            </li>
          ))}
        </ul>
      )}
      <div>
        <label htmlFor="screen-min" className="label">
          Recreational screen minutes today
        </label>
        <input
          id="screen-min"
          className="input tnum max-w-[12rem]"
          inputMode="numeric"
          autoFocus
          value={screen}
          onChange={(e) => setScreen(e.target.value.replace(/[^\d]/g, ""))}
          aria-describedby="screen-hint"
        />
        <p id="screen-hint" className="mt-1.5 text-sm text-ink-2">
          Phone's digital wellbeing has the number. Up to 120 is free.
        </p>
      </div>
    </StepForm>
  );
}

// ---------- 2. small win ----------

function SmallWin({ day, onNext, onBack }: { day: DayView; onNext: () => void; onBack: () => void }) {
  const [win, setWin] = useState(day.day?.smallWin ?? "");
  return (
    <StepForm
      onBack={onBack}
      onSubmit={async () => {
        await updateDay(day.date, { smallWin: win.trim() || null });
        onNext();
      }}
      extra={
        <button type="button" className="btn-ghost" onClick={onNext}>
          Skip
        </button>
      }
    >
      <div>
        <label htmlFor="small-win" className="label">
          One small win from today
        </label>
        <input
          id="small-win"
          className="input"
          autoFocus
          maxLength={200}
          value={win}
          onChange={(e) => setWin(e.target.value)}
          placeholder="e.g. Finished the VPC module before lunch"
        />
      </div>
    </StepForm>
  );
}

// ---------- 3. three questions ----------

function Questions({ day, onNext, onBack }: { day: DayView; onNext: () => void; onBack: () => void }) {
  const d = day.day;
  const [qP1, setQP1] = useState(d?.qP1 ?? "");
  const [qDrift, setQDrift] = useState(d?.qDrift ?? "");
  const [qPractised, setQPractised] = useState(d?.qPractised ?? "");
  return (
    <StepForm
      onBack={onBack}
      onSubmit={async () => {
        await updateDay(day.date, {
          qP1: qP1.trim() || null,
          qDrift: qDrift.trim() || null,
          qPractised: qPractised.trim() || null,
        });
        onNext();
      }}
    >
      <div>
        <label htmlFor="q-p1" className="label">
          Did you do P1?
        </label>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Quick answers">
          {["Yes", "The Minimum", "Not this time"].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={qP1 === a}
              onClick={() => setQP1(a)}
              className={`chip ${qP1 === a ? "bg-lime text-on-accent" : "bg-surface-2 font-medium hover:bg-line"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <input id="q-p1" className="input" autoFocus maxLength={300} value={qP1} onChange={(e) => setQP1(e.target.value)} />
      </div>
      <div>
        <label htmlFor="q-drift" className="label">
          What made you drift?
        </label>
        <input id="q-drift" className="input" maxLength={300} value={qDrift} onChange={(e) => setQDrift(e.target.value)} />
      </div>
      <div>
        <label htmlFor="q-practised" className="label">
          What did you practise?
        </label>
        <input id="q-practised" className="input" maxLength={300} value={qPractised} onChange={(e) => setQPractised(e.target.value)} />
      </div>
    </StepForm>
  );
}

// ---------- 4. close loops ----------

function CloseLoops({ day, onNext, onBack }: { day: DayView; onNext: () => void; onBack: () => void }) {
  const open = day.missions.filter((m) => m.status !== "done" && m.status !== "rescheduled");
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((m) => [m.id, m.resumeNote ?? ""] as const)),
  );
  return (
    <StepForm
      onBack={onBack}
      onSubmit={async () => {
        for (const m of open) {
          const v = (notes[m.id] ?? "").trim() || null;
          if (v !== m.resumeNote) await patchMissionFree(m, { resumeNote: v });
        }
        onNext();
      }}
    >
      {open.length === 0 ? (
        <p className="text-ink-2">No open loops. Everything from today is closed.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">For each unfinished mission: where should you pick up next time?</p>
          {open.map((m, i) => (
            <div key={m.id}>
              <label htmlFor={`loop-${m.id}`} className="label">
                {m.title}
              </label>
              <input
                id={`loop-${m.id}`}
                className="input"
                autoFocus={i === 0}
                maxLength={500}
                value={notes[m.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [m.id]: e.target.value }))}
                placeholder="e.g. Next: write the outputs.tf for the subnet"
              />
            </div>
          ))}
        </>
      )}
    </StepForm>
  );
}

// ---------- 5. capacity ----------

function Capacity(props: {
  tomorrow: DayView;
  anchors: Anchor[];
  settings: ResolvedSettings;
  freeMin: number | null;
  onNext: (freeMin: number) => void;
  onBack: () => void;
}) {
  const suggested = defaultFree(props.settings, props.anchors);
  const [free, setFree] = useState(String(props.freeMin ?? suggested));
  const freeN = Number.parseInt(free, 10) || 0;
  const planned = plannedMinutes(props.tomorrow.missions);
  return (
    <StepForm onBack={props.onBack} onSubmit={() => props.onNext(freeN)}>
      <section aria-labelledby="anchors-title">
        <h2 id="anchors-title" className="mb-2">
          Tomorrow's anchors
        </h2>
        {props.anchors.length === 0 ? (
          <p className="text-sm text-ink-2">
            No fixed blocks tomorrow.{" "}
            <Link to="/settings#anchors" className="link">
              Add anchors in Settings
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {props.anchors.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-4 pr-1.5 text-sm font-medium">
                <span>{a.name}</span>
                <span className="tnum rounded-full bg-charcoal px-2.5 py-1 text-xs font-semibold text-on-charcoal">
                  {a.startTime}–{a.endTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div>
        <label htmlFor="free-min" className="label">
          Free minutes tomorrow
        </label>
        <input
          id="free-min"
          className="input tnum max-w-[12rem]"
          inputMode="numeric"
          autoFocus
          value={free}
          onChange={(e) => setFree(e.target.value.replace(/[^\d]/g, ""))}
          aria-describedby="free-hint"
        />
        <p id="free-hint" className="mt-1.5 text-sm text-ink-2">
          Suggested {suggested} min: wake {props.settings.wake_time} to ritual {props.settings.ritual_time}, minus anchors.
        </p>
      </div>
      <CapacityBar plannedMin={planned} freeMin={freeN} scoring={props.settings.scoring} />
      <Kural n={475} size="sm" />
    </StepForm>
  );
}

// ---------- 6. pick missions (5 by default, up to 9) ----------

interface SlotDraft {
  /** Existing mission (tomorrow's, or picked from the backlog). */
  source: Mission | null;
  title: string;
  minimum: string;
  ifThen: string;
  estMin: string;
  points: number;
}

const RANKED: readonly RankedSlot[] = RANKED_SLOTS;

/** Rows shown: DEFAULT_RANKED, or more when tomorrow already uses a later slot. */
function initialRows(slots: DayView["slots"]): number {
  const last = RANKED.reduce((n, s, i) => (slots[s] ? i + 1 : n), 0);
  return Math.min(MAX_RANKED, Math.max(DEFAULT_RANKED, last));
}

function draftFrom(m: Mission | undefined): SlotDraft {
  return {
    source: m ?? null,
    title: m?.title ?? "",
    minimum: m?.minimum ?? "",
    ifThen: m?.ifThen ?? "",
    estMin: m?.estMin != null ? String(m.estMin) : "",
    points: m?.points ?? 1,
  };
}

function PickThree(props: { tomorrow: DayView; settings: ResolvedSettings; freeMin: number; onNext: () => void; onBack: () => void }) {
  const toast = useToast();
  const { data: backlog = [] } = useBacklog();
  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>(() =>
    Object.fromEntries(RANKED.map((s) => [s, draftFrom(props.tomorrow.slots[s])] as const)),
  );
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(() => initialRows(props.tomorrow.slots));
  const shown = RANKED.slice(0, rows);

  const set = (slot: string, patch: Partial<SlotDraft>) => setDrafts((d) => ({ ...d, [slot]: { ...(d[slot] ?? draftFrom(undefined)), ...patch } }));
  const usedIds = new Set(Object.values(drafts).map((d) => d.source?.id).filter(Boolean));
  const plannedMin =
    RANKED.reduce((sum, s) => sum + (drafts[s]?.title.trim() ? Number.parseInt(drafts[s]?.estMin ?? "", 10) || 0 : 0), 0);

  async function onSubmit() {
    const p1 = drafts.P1;
    if (!p1 || !p1.title.trim()) return setError("Pick a P1 — the one mission that makes tomorrow a win.");
    if (!p1.minimum.trim() || !p1.ifThen.trim()) return setError("P1 needs a Minimum version and an if-then plan.");
    setError(null);
    for (const slot of RANKED) {
      const d = drafts[slot];
      if (!d) continue;
      const title = d.title.trim();
      if (!title) {
        // Cleared: send the mission back to the backlog rather than losing it.
        if (d.source && d.source.dayDate === props.tomorrow.date) await toBacklog(d.source);
        continue;
      }
      const est = Number.parseInt(d.estMin, 10);
      const fields = {
        title,
        minimum: d.minimum.trim() || null,
        ifThen: d.ifThen.trim() || null,
        estMin: Number.isFinite(est) && est > 0 ? est : null,
        points: d.points === 1 ? null : d.points,
        dayDate: props.tomorrow.date,
        slot,
        status: "open" as const,
      };
      await upsertMission(d.source ? { ...d.source, ...fields } : fields);
    }
    // Missions that were on tomorrow's ranked slots but got replaced by a backlog pick.
    for (const slot of RANKED) {
      const prev = props.tomorrow.slots[slot];
      if (prev && !usedIds.has(prev.id)) await toBacklog(prev);
    }
    toast("Saved.", { durationMs: 1500 });
    props.onNext();
  }

  return (
    <StepForm onBack={props.onBack} onSubmit={onSubmit}>
      <p className="text-sm text-ink-2">
        Ranked, {DEFAULT_RANKED} to start and up to {MAX_RANKED}. P1 is the one that makes tomorrow a win. Leave the rest blank if the day is full.
      </p>
      {shown.map((slot) => {
        const d = drafts[slot] ?? draftFrom(undefined);
        const isP1 = slot === "P1";
        const id = (k: string) => `pick-${slot}-${k}`;
        return (
          <fieldset key={slot} className={`rounded-card-inner bg-surface-2 p-5 ${isP1 ? "ring-2 ring-lime" : ""}`}>
            <legend className="sr-only">
              {slot}
              {isP1 ? ", needs a Minimum and an if-then" : ", optional"}
            </legend>
            <p aria-hidden="true" className="mb-3 flex items-center gap-2 text-sm">
              <span className={`pill ${isP1 ? "bg-lime text-on-accent" : slot === "P2" ? "bg-lavender text-on-accent" : "bg-surface text-ink"}`}>
                {slot}
              </span>
              <span className="text-ink-2">{isP1 ? "Needs a Minimum and an if-then" : "Optional"}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor={id("title")} className="label">
                  Mission
                </label>
                <input
                  id={id("title")}
                  className="input"
                  autoFocus={isP1}
                  maxLength={200}
                  value={d.title}
                  onChange={(e) => set(slot, { title: e.target.value })}
                />
                {backlog.length > 0 && !d.source && (
                  <div className="mt-2">
                    <label htmlFor={id("backlog")} className="sr-only">
                      Pick {slot} from the backlog
                    </label>
                    <select
                      id={id("backlog")}
                      className="input text-sm"
                      value=""
                      onChange={(e) => {
                        const m = backlog.find((b) => b.id === e.target.value);
                        if (m) set(slot, draftFrom(m));
                      }}
                    >
                      <option value="">…or pick from backlog ({backlog.filter((b) => !usedIds.has(b.id)).length})</option>
                      {backlog
                        .filter((b) => !usedIds.has(b.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}
                            {b.rescheduleCount > 1 ? ` (moved ${b.rescheduleCount}×)` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              {isP1 && (
                <>
                  <div>
                    <label htmlFor={id("min")} className="label">
                      Minimum version
                    </label>
                    <input
                      id={id("min")}
                      className="input"
                      maxLength={200}
                      value={d.minimum}
                      onChange={(e) => set(slot, { minimum: e.target.value })}
                      placeholder="The smallest thing that still counts"
                    />
                  </div>
                  <div>
                    <label htmlFor={id("ifthen")} className="label">
                      If-then plan
                    </label>
                    <input
                      id={id("ifthen")}
                      className="input"
                      maxLength={300}
                      value={d.ifThen}
                      onChange={(e) => set(slot, { ifThen: e.target.value })}
                      placeholder="If it's 7:00 and I've had tea, then I open the laptop and start"
                    />
                    <IfThenTemplates onPick={(t) => set(slot, { ifThen: t })} />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={id("est")} className="label">
                    Estimate (min)
                  </label>
                  <input
                    id={id("est")}
                    className="input tnum"
                    inputMode="numeric"
                    value={d.estMin}
                    onChange={(e) => set(slot, { estMin: e.target.value.replace(/[^\d]/g, "") })}
                  />
                </div>
                <div>
                  <label htmlFor={id("points")} className="label">
                    Points
                  </label>
                  <select id={id("points")} className="input" value={d.points} onChange={(e) => set(slot, { points: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(d.source || d.title) && (
                <button type="button" className="btn-ghost text-sm text-ink-2" onClick={() => set(slot, draftFrom(undefined))}>
                  Clear {slot}
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
      {rows < MAX_RANKED && (
        <button type="button" className="btn-secondary self-start" onClick={() => setRows((n) => Math.min(MAX_RANKED, n + 1))}>
          <PlusIcon size={18} /> Add {RANKED[rows]}
        </button>
      )}
      <CapacityBar plannedMin={plannedMin} freeMin={props.freeMin} scoring={props.settings.scoring} />
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </StepForm>
  );
}

// ---------- 7. side quest ----------

function SideQuest({ tomorrow, onNext, onBack }: { tomorrow: DayView; onNext: () => void; onBack: () => void }) {
  const existing = tomorrow.slots.side;
  const [title, setTitle] = useState(existing?.title ?? "");
  return (
    <StepForm
      onBack={onBack}
      onSubmit={async () => {
        const t = title.trim();
        if (t) await upsertMission(existing ? { ...existing, title: t } : { title: t, slot: "side", dayDate: tomorrow.date });
        else if (existing) await deleteMission(existing);
        onNext();
      }}
      extra={
        <button type="button" className="btn-ghost" onClick={onNext}>
          Skip
        </button>
      }
    >
      <div>
        <label htmlFor="side" className="label">
          One side quest (optional, unscored)
        </label>
        <input
          id="side"
          className="input"
          autoFocus
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Something light you'd enjoy, e.g. 15 min of Japanese kana"
        />
      </div>
    </StepForm>
  );
}

// ---------- 8. shutdown ----------

function Shutdown(props: { tomorrow: DayView; onBack: () => void; onFixPlan: () => void; onForged: () => void }) {
  const { slots } = props.tomorrow;
  const [typed, setTyped] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function lock() {
    if (busy) return;
    setBusy(true);
    const res = await forge(props.tomorrow.date);
    setBusy(false);
    if (res.length > 0) {
      setProblems(res.map((p) => FORGE_PROBLEM_COPY[p]));
      return;
    }
    props.onForged();
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="plan-title" className="space-y-3">
        <h2 id="plan-title">Tomorrow</h2>
        {slots.P1 ? (
          <div className="rounded-card bg-charcoal p-6 text-on-charcoal">
            <p className="pill w-fit bg-lime text-on-accent">P1</p>
            <p className="mt-3 text-p1">{slots.P1.title}</p>
            <p className="mt-3 text-sm text-on-charcoal-2">Minimum · {slots.P1.minimum}</p>
            <p className="text-sm text-on-charcoal-2">If-then · {slots.P1.ifThen}</p>
          </div>
        ) : (
          <p className="text-ink-2">No P1 yet.</p>
        )}
        <ul className="space-y-2">
          {AFTER_P1.map((s) =>
            slots[s] ? (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="pill bg-surface-2 text-ink">{s === "side" ? "Side quest" : s}</span>
                {slots[s]?.title}
              </li>
            ) : null,
          )}
        </ul>
      </section>

      {problems.length > 0 && (
        <div role="alert" className="space-y-2 text-sm">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <button type="button" className="btn-secondary" onClick={props.onFixPlan}>
            Back to Pick missions
          </button>
        </div>
      )}

      <div className="space-y-4 border-t border-line pt-6">
        <HoldButton label="Hold to lock tomorrow" onComplete={() => void lock()} disabled={busy} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim().toLowerCase() === "done") void lock();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <label htmlFor="type-done" className="label">
              …or type “done” and press Enter
            </label>
            <input id="type-done" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        </form>
        <button type="button" className="btn-ghost" onClick={props.onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

const HOLD_MS = 1500;

/** Press-and-hold (pointer or Space/Enter) for 1.5 s. Progress is state, so it shows even with reduced motion. */
function HoldButton(props: { label: string; onComplete: () => void; disabled?: boolean; holdMs?: number; text?: string }) {
  const holdMs = props.holdMs ?? HOLD_MS;
  const hintId = useId();
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setProgress(0);
  };

  const start = () => {
    if (props.disabled || startRef.current !== null) return;
    startRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const s = startRef.current;
      if (s === null) return;
      const p = Math.min(1, (performance.now() - s) / holdMs);
      setProgress(p);
      if (p >= 1) {
        stop();
        props.onComplete();
      }
    }, 30);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      disabled={props.disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-describedby={hintId}
      className="relative flex min-h-[64px] w-full select-none items-center justify-center overflow-hidden rounded-full bg-lime-soft text-lg font-semibold text-ink ring-2 ring-inset ring-lime disabled:opacity-50"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-lime" style={{ width: `${progress * 100}%` }} />
      <span className={`relative ${progress > 0.5 ? "text-on-accent" : ""}`}>{props.text ?? `Shutdown complete — ${props.label.toLowerCase()}`}</span>
      <span id={hintId} className="sr-only">
        Press and hold for {holdMs / 1000} seconds.
      </span>
    </button>
  );
}

type RestartStage = "why" | "wait" | "confirm";

/**
 * Restarting the ritual unlocks tomorrow's plan. Deliberately slow: a written reason (≥ 20 characters),
 * a 15-second pause, typing "restart", then a 3-second hold. The server allows it once per plan and
 * twice in 7 days, and Sunday's review shows the reason. "Keep my plan" is the primary button throughout.
 */
function RitualRestart(props: { date: ISODate; open: boolean; onClose: () => void; onRestarted: () => void }) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Restart the night ritual?" description="Your plan is locked so tomorrow-you can trust it.">
      {props.open && <RestartFlow {...props} />}
    </Modal>
  );
}

function RestartFlow(props: { date: ISODate; onClose: () => void; onRestarted: () => void }) {
  const toast = useToast();
  const [stage, setStage] = useState<RestartStage>("why");
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const [wait, setWait] = useState<number>(RITUAL_RESTART.waitSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chars = reason.trim().length;

  useEffect(() => {
    if (stage !== "wait" || wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, wait]);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      await api(`/days/${props.date}/restart`, { method: "POST", body: { reason: reason.trim(), confirm: RITUAL_RESTART.word } });
      await flushNow();
      toast("Unlocked. Plan again, calmly. The reason is saved for Sunday.");
      props.onRestarted();
    } catch (e) {
      const code = e instanceof ApiError && typeof e.body === "object" && e.body !== null ? (e.body as { error?: unknown }).error : null;
      setError(
        isNetworkError(e)
          ? "Restarting needs a connection."
          : code === "restart_used"
            ? "This plan was already restarted once. Keep it, or change single missions with a reason."
            : code === "restart_limit"
              ? `The ritual can be restarted ${RITUAL_RESTART.perWeek} times in 7 days. Keep this plan.`
              : "That didn't work. Your plan is still locked.",
      );
    } finally {
      setBusy(false);
    }
  }

  const keep = (
    <button type="button" className="btn-primary" onClick={props.onClose}>
      Keep my plan
    </button>
  );

  return (
    <div className="space-y-5">
      <ol className="flex gap-2 text-xs font-semibold text-ink-2" aria-label="Steps">
        {(["why", "wait", "confirm"] as const).map((s, i) => (
          <li key={s} aria-current={stage === s ? "step" : undefined} className={`rounded-full px-3 py-1 ${stage === s ? "bg-charcoal text-on-charcoal" : "bg-surface-2"}`}>
            {i + 1}. {s === "why" ? "Why" : s === "wait" ? "Pause" : "Confirm"}
          </li>
        ))}
      </ol>

      {stage === "why" && (
        <>
          <Kural n={467} size="sm" />
          <p className="text-sm text-ink-2">
            Restarting unlocks tomorrow so you can plan it again. It works once per plan and {RITUAL_RESTART.perWeek} times a week, and the reason
            shows in Sunday's review. To change one mission, edit it from Today instead.
          </p>
          <div>
            <label htmlFor="restart-why" className="label">
              What changed since you locked it?
            </label>
            <textarea
              id="restart-why"
              className="input min-h-[96px] py-3"
              maxLength={250}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="tnum mt-1 text-xs text-ink-2">
              {chars < RITUAL_RESTART.minReason ? `${RITUAL_RESTART.minReason - chars} more characters` : "Thanks. That's honest enough."}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" disabled={chars < RITUAL_RESTART.minReason} onClick={() => setStage("wait")}>
              Continue
            </button>
            {keep}
          </div>
        </>
      )}

      {stage === "wait" && (
        <>
          <p className="text-lg">Sit with it for a moment.</p>
          <p className="text-sm text-ink-2">You made this plan with a clear head. If it still feels wrong in {RITUAL_RESTART.waitSeconds} seconds, go on.</p>
          <p className="tnum text-title-sm" role="timer" aria-live="off">
            {wait > 0 ? `0:${String(wait).padStart(2, "0")}` : "0:00"}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" disabled={wait > 0} onClick={() => setStage("confirm")}>
              {wait > 0 ? "Wait…" : "Continue"}
            </button>
            {keep}
          </div>
        </>
      )}

      {stage === "confirm" && (
        <>
          <div>
            <label htmlFor="restart-word" className="label">
              Type <span className="font-semibold text-ink">{RITUAL_RESTART.word}</span> to unlock tomorrow
            </label>
            <input
              id="restart-word"
              className="input"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
          </div>
          <HoldButton
            label="restart"
            text={busy ? "Unlocking…" : "Hold to unlock tomorrow"}
            holdMs={RITUAL_RESTART.holdMs}
            disabled={busy || word.trim().toLowerCase() !== RITUAL_RESTART.word}
            onComplete={() => void unlock()}
          />
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <div className="flex justify-end">{keep}</div>
        </>
      )}
    </div>
  );
}

function ShutdownComplete({ fresh, date, onRestarted }: { fresh: boolean; date: ISODate; onRestarted: () => void }) {
  const [restarting, setRestarting] = useState(false);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-read flex-col items-start justify-center gap-4">
      <span className="icon-btn pointer-events-none mb-2 h-16 w-16 bg-lime text-on-accent" aria-hidden="true">
        <MoonIcon size={28} />
      </span>
      <h1 className="text-title">Shutdown complete.</h1>
      <p className="text-xl">Phone outside the room.</p>
      <p className="text-ink-2">
        {fresh ? "Tomorrow is locked. Sleep well." : "Tomorrow is already locked. Changing it needs a reason, from Today."}
      </p>
      <Kural n={664} className="mt-2" />
      <Link to="/today" className="btn-secondary mt-4">
        Back to Today
      </Link>
      <button type="button" className="btn-ghost mt-6 text-sm font-medium text-ink-2" onClick={() => setRestarting(true)}>
        Restart the ritual…
      </button>
      <RitualRestart
        date={date}
        open={restarting}
        onClose={() => setRestarting(false)}
        onRestarted={() => {
          setRestarting(false);
          onRestarted();
        }}
      />
    </div>
  );
}
