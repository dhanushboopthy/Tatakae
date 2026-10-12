import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { addDays, type Anchor, type ISODate, type Mission, type ResolvedSettings, type Slot } from "@tatakae/core";
import { CapacityBar } from "../components/CapacityBar";
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
import { anchorsFor, freeMinutes, plannedMinutes } from "../lib/plan";
import { storage } from "../lib/storage";

// Night ritual (laptop, ≤ 5 min): 8 steps per docs/02-method.md + docs/05-ui-ux.md.
// Progress dots, Enter advances, every step autosaves to the local store, and the current step is
// remembered (localStorage, per day) so an interrupted ritual resumes where it stopped.

const STEPS = [
  "Close today",
  "Small win",
  "Three questions",
  "Close loops",
  "Capacity",
  "Pick three",
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
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const todayQ = useDay(today);
  const tomorrowQ = useDay(tomorrow);
  const settings = useSettings().data;
  const anchors = useAnchors().data;
  const [state, update] = useRitualState(today);
  const [justForged, setJustForged] = useState(false);

  if (!todayQ.data || !tomorrowQ.data || !settings || !anchors) {
    return <p className="text-legacy-muted">Opening the ritual…</p>;
  }

  if (tomorrowQ.data.forged) return <ShutdownComplete fresh={justForged} />;

  const next = () => update({ step: state.step + 1 });
  const back = () => update({ step: state.step - 1 });
  const step = state.step;

  return (
    <div className="mx-auto max-w-read">
      <div className="rounded-legacy-card border border-legacy-line bg-legacy-ritual p-6 md:p-8">
        <header className="mb-6">
          <p className="text-sm text-legacy-muted">Night ritual · about five minutes</p>
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
      <ol className="flex items-center gap-1" aria-label="Ritual progress">
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
                  className={`block rounded-full ${
                    current ? "h-3 w-3 bg-legacy-ember" : done ? "h-2.5 w-2.5 bg-legacy-paper" : "h-2.5 w-2.5 border border-legacy-line-strong"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <h1 className="mt-2" aria-live="polite">
        <span className="tnum text-legacy-muted">{props.step + 1}/8 · </span>
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-legacy-line pt-4">
        {props.onBack ? (
          <button type="button" className="btn-ghost" onClick={props.onBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {props.extra}
          <button type="submit" className="btn-primary" disabled={busy}>
            {props.nextLabel ?? "Next"} <span className="kbd border-legacy-ink/40 text-legacy-ink">Enter</span>
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
        <p className="text-legacy-muted">Nothing was planned today. That's fine — tomorrow starts tonight.</p>
      ) : (
        <ul className="space-y-4">
          {missions.map((m) => (
            <li key={m.id} className="rounded-legacy-card border border-legacy-line bg-legacy-ritual-2 p-4">
              <p className="mb-3">
                <span className="text-sm text-legacy-muted">{m.slot === "side" ? "Side quest" : m.slot} · </span>
                <span className="font-medium">{m.title}</span>
              </p>
              <StatusChips value={m.status} onChange={(s) => void setStatus(m, s)} label={m.title} />
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
        <p id="screen-hint" className="mt-1 text-sm text-legacy-muted">
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
              className={`min-h-tap rounded-full border px-4 text-sm ${qP1 === a ? "border-legacy-paper bg-legacy-ink-3" : "border-legacy-line-strong hover:bg-legacy-ink-3"}`}
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
        <p className="text-legacy-muted">No open loops. Everything from today is closed.</p>
      ) : (
        <>
          <p className="text-sm text-legacy-muted">For each unfinished mission: where should you pick up next time?</p>
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
          <p className="text-sm text-legacy-muted">
            No fixed blocks tomorrow. <Link to="/settings#anchors" className="underline underline-offset-4">Add anchors in Settings</Link>.
          </p>
        ) : (
          <ul className="space-y-1">
            {props.anchors.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 text-sm">
                <span>{a.name}</span>
                <span className="tnum text-legacy-muted">
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
        <p id="free-hint" className="mt-1 text-sm text-legacy-muted">
          Suggested {suggested} min: wake {props.settings.wake_time} to ritual {props.settings.ritual_time}, minus anchors.
        </p>
      </div>
      <CapacityBar plannedMin={planned} freeMin={freeN} scoring={props.settings.scoring} />
    </StepForm>
  );
}

// ---------- 6. pick three ----------

interface SlotDraft {
  /** Existing mission (tomorrow's, or picked from the backlog). */
  source: Mission | null;
  title: string;
  minimum: string;
  ifThen: string;
  estMin: string;
  points: number;
}

const RANKED: readonly Exclude<Slot, "side" | "backlog">[] = ["P1", "P2", "P3"];

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
      <p className="text-sm text-legacy-muted">Three at most, ranked. P1 is the one that makes tomorrow a win.</p>
      {RANKED.map((slot) => {
        const d = drafts[slot] ?? draftFrom(undefined);
        const isP1 = slot === "P1";
        const id = (k: string) => `pick-${slot}-${k}`;
        return (
          <fieldset key={slot} className={`rounded-legacy-card border bg-legacy-ritual-2 p-4 ${isP1 ? "border-legacy-ember" : "border-legacy-line"}`}>
            <legend className={`px-1 text-sm font-semibold ${isP1 ? "text-legacy-ember" : "text-legacy-muted"}`}>
              {slot}
              {isP1 ? " · needs a Minimum and an if-then" : " · optional"}
            </legend>
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
                <button type="button" className="btn-ghost text-sm text-legacy-muted" onClick={() => set(slot, draftFrom(undefined))}>
                  Clear {slot}
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
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
          <div className="rounded-legacy-card border border-legacy-ember bg-legacy-ritual-2 p-4">
            <p className="text-sm font-semibold text-legacy-ember">P1</p>
            <p className="text-p1">{slots.P1.title}</p>
            <p className="mt-2 text-sm">
              <span className="text-legacy-muted">Minimum </span>
              {slots.P1.minimum}
            </p>
            <p className="text-sm">
              <span className="text-legacy-muted">If-then </span>
              {slots.P1.ifThen}
            </p>
          </div>
        ) : (
          <p className="text-legacy-muted">No P1 yet.</p>
        )}
        <ul className="space-y-1">
          {(["P2", "P3", "side"] as const).map((s) =>
            slots[s] ? (
              <li key={s} className="text-sm">
                <span className="text-legacy-muted">{s === "side" ? "Side quest" : s} · </span>
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
            Back to Pick three
          </button>
        </div>
      )}

      <div className="space-y-4 border-t border-legacy-line pt-6">
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
function HoldButton(props: { label: string; onComplete: () => void; disabled?: boolean }) {
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
      const p = Math.min(1, (performance.now() - s) / HOLD_MS);
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
      aria-describedby="hold-hint"
      className="relative flex min-h-[56px] w-full select-none items-center justify-center overflow-hidden rounded-control border border-legacy-ember bg-legacy-ember-soft text-lg font-semibold text-legacy-paper disabled:opacity-50"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-legacy-ember/40" style={{ width: `${progress * 100}%` }} />
      <span className="relative">Shutdown complete — {props.label.toLowerCase()}</span>
      <span id="hold-hint" className="sr-only">
        Press and hold for one and a half seconds.
      </span>
    </button>
  );
}

function ShutdownComplete({ fresh }: { fresh: boolean }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-read flex-col items-start justify-center gap-4">
      <h1 className="text-p1">Shutdown complete.</h1>
      <p className="text-xl">Phone outside the room.</p>
      <p className="text-legacy-muted">
        {fresh ? "Tomorrow is locked. Sleep well." : "Tomorrow is already locked. Changing it needs a reason, from Today."}
      </p>
      <Link to="/today" className="btn-secondary mt-4">
        Back to Today
      </Link>
    </div>
  );
}
