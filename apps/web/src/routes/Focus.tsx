import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { FocusSession, Mission } from "@tatakae/core";
import { FocusRing } from "../components/FocusRing";
import { CheckIcon, DashIcon, PauseIcon, PlayIcon, PlusIcon, StuckIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { PageHeader } from "../components/PageHeader";
import { RechargeMenu } from "../components/RechargeMenu";
import { StuckSheet } from "../components/StuckSheet";
import { useToast } from "../components/Toast";
import { endFocusSession, setStatus, startFocusSession, useDay, useMission, useNow, useRunningFocus, useSettings, useToday } from "../lib/hooks";
import { FOCUS_MAX, FOCUS_MIN, clampFocus, durationLabel, focusLengthFor, focusRemainingMs, formatCountdown } from "../lib/plan";
import { requestWakeLock } from "../lib/platform";
import { storage } from "../lib/storage";

// Focus (docs/05, docs/10 §6): huge countdown inside a lime ring, mission title, Pause / Done / Stuck
// as three pills, resume note card below. The timer is derived from the session's start time (never
// ticked), so a reload or a second tab shows the same number. Pause ends the session and offers to
// resume with the minutes left. After a block → recharge menu. Length: the mission's planned minutes
// by default (calendar / ritual), or any length from 5 to 240 minutes (−5 / typed / +5). No presets.

const PAUSED_KEY = "tatakae.focus.paused"; // { missionId, remainingMin }

interface Paused {
  missionId: string | null;
  remainingMin: number;
}

export function Focus() {
  const [params] = useSearchParams();
  const { data: running, isLoading } = useRunningFocus();
  const [after, setAfter] = useState<{ minutes: number; mission: Mission | null } | null>(null);

  if (isLoading) return <p className="text-ink-2">Opening…</p>;
  if (after) return <AfterBlock minutes={after.minutes} mission={after.mission} onDone={() => setAfter(null)} />;
  if (running) return <Running session={running} onFinished={(minutes, mission) => setAfter({ minutes, mission })} />;
  return <Setup initialMission={params.get("mission")} initialMin={Number(params.get("min")) || null} />;
}

// ---------- setup ----------

function Setup(props: { initialMission: string | null; initialMin: number | null }) {
  const today = useToday();
  const { data: day } = useDay(today);
  const { data: settings } = useSettings();
  const toast = useToast();
  const [paused, setPaused] = useState(() => storage.getJson<Paused | null>(PAUSED_KEY, null));
  const [missionId, setMissionId] = useState<string | null>(props.initialMission ?? paused?.missionId ?? null);
  // An explicit choice (preset, typed or from the URL); null = follow the mission's plan.
  const [length, setLength] = useState<number | null>(props.initialMin != null ? clampFocus(props.initialMin) : null);
  const [typed, setTyped] = useState<string | null>(null);

  const open = (day?.missions ?? []).filter((m) => m.status === "open" || m.status === "missed");
  const chosenId = missionId ?? open[0]?.id ?? null;
  const { data: mission } = useMission(chosenId);
  const planned = focusLengthFor(mission?.estMin, settings?.focus_default ?? 50);
  const chosenLength = length ?? planned.minutes;
  const typedValid = typed === null || (/^\d+$/.test(typed) && Number(typed) >= FOCUS_MIN && Number(typed) <= FOCUS_MAX);

  const choose = (min: number) => {
    setLength(clampFocus(min));
    setTyped(null);
  };

  async function start(min: number) {
    storage.remove(PAUSED_KEY);
    await startFocusSession({ missionId: chosenId, plannedMin: min });
    toast(`${durationLabel(min)}. Phone face down.`);
  }

  return (
    <div className="page-read">
      <PageHeader eyebrow="Focus" title="One block, one mission." quiet />

      {paused && paused.remainingMin > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-lavender-soft p-4 pl-5">
          <p className="flex-1 font-medium">Paused with {paused.remainingMin} min left.</p>
          <button type="button" className="btn-primary" onClick={() => void start(paused.remainingMin)}>
            <PlayIcon size={18} /> Resume
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              storage.remove(PAUSED_KEY);
              setPaused(null);
            }}
          >
            Start fresh
          </button>
        </div>
      )}

      <section className="card space-y-6">
        <fieldset>
          <legend className="label">Mission</legend>
          {open.length === 0 && !mission ? (
            <p className="text-sm text-ink-2">
              Nothing open today. You can still run a block without a mission, or{" "}
              <Link to="/today" className="link">
                plan P1
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...open, ...(mission && !open.some((m) => m.id === mission.id) ? [mission] : [])].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={chosenId === m.id}
                  onClick={() => {
                    setMissionId(m.id);
                    setLength(null); // follow this mission's planned minutes
                    setTyped(null);
                  }}
                  className={`chip ${chosenId === m.id ? "bg-charcoal text-on-charcoal" : "bg-surface-2 font-medium hover:bg-line"}`}
                >
                  <span className="text-xs font-bold opacity-80">{m.slot === "side" ? "Side" : m.slot}</span>
                  {m.title}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {mission?.resumeNote && (
          <div className="card-inner">
            <p className="text-sm font-semibold text-ink-2">Resume note</p>
            <p className="mt-1">{mission.resumeNote}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="label mb-0" id="len-label">
            Length
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-labelledby="len-label">
              <button type="button" className="icon-btn-sm bg-surface" aria-label="5 minutes less" disabled={chosenLength <= FOCUS_MIN} onClick={() => choose(chosenLength - 5)}>
                <DashIcon size={18} />
              </button>
              <label htmlFor="focus-len" className="sr-only">
                Minutes ({FOCUS_MIN} to {FOCUS_MAX})
              </label>
              <input
                id="focus-len"
                className="tnum h-11 w-16 rounded-full bg-transparent text-center text-base font-semibold"
                inputMode="numeric"
                value={typed ?? String(chosenLength)}
                aria-invalid={!typedValid}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                  setTyped(v);
                  const n = Number(v);
                  if (v && n >= FOCUS_MIN && n <= FOCUS_MAX) setLength(n);
                }}
                onBlur={() => setTyped(null)}
              />
              <button type="button" className="icon-btn-sm bg-surface" aria-label="5 minutes more" disabled={chosenLength >= FOCUS_MAX} onClick={() => choose(chosenLength + 5)}>
                <PlusIcon size={18} />
              </button>
              <span className="pr-3 text-sm font-medium text-ink-2">min</span>
            </div>
          </div>
          <p className="text-sm text-ink-2" aria-live="polite">
            {!typedValid
              ? `Pick ${FOCUS_MIN} to ${FOCUS_MAX} minutes.`
              : length === null && planned.fromPlan
                ? `From the plan: ${durationLabel(planned.minutes)} for this mission.`
                : length === null
                  ? "Your default length. Set a mission's minutes in the calendar to use them here."
                  : durationLabel(chosenLength)}
          </p>
        </div>

        <button type="button" className="btn-accent min-h-[56px] w-full text-lg" disabled={!typedValid} onClick={() => void start(chosenLength)}>
          <PlayIcon size={20} /> Start {durationLabel(chosenLength)}
        </button>
      </section>
    </div>
  );
}

// ---------- running ----------

function Running(props: { session: FocusSession; onFinished: (minutes: number, mission: Mission | null) => void }) {
  const s = props.session;
  const now = useNow(1000);
  const { data: mission } = useMission(s.missionId);
  const [stuck, setStuck] = useState(false);
  const remaining = focusRemainingMs(s.startedAt, s.plannedMin, now);
  const fraction = remaining / (s.plannedMin * 60_000);
  const countdown = formatCountdown(remaining);

  // Keep the screen on while the block runs; show the countdown in the tab title.
  useEffect(() => {
    let release: () => void = () => undefined;
    void requestWakeLock().then((r) => {
      release = r;
    });
    return () => release();
  }, [s.id]);
  useEffect(() => {
    const prev = document.title;
    document.title = `${countdown} · Focus`;
    return () => {
      document.title = prev;
    };
  }, [countdown]);

  // Ran to the end. `ended` guards against a second end (StrictMode effects, a click racing the timer).
  const ended = useRef(false);
  const finished = remaining === 0;
  useEffect(() => {
    if (!finished || ended.current) return;
    ended.current = true;
    void endFocusSession(s, { completed: true }).then((min) => props.onFinished(min, mission ?? null));
  }, [finished, s, mission, props]);

  async function pause() {
    if (ended.current) return;
    ended.current = true;
    const left = Math.max(1, Math.ceil(remaining / 60_000));
    storage.setJson(PAUSED_KEY, { missionId: s.missionId, remainingMin: left } satisfies Paused);
    await endFocusSession(s, { completed: false });
  }

  async function done() {
    if (ended.current) return;
    ended.current = true;
    const min = await endFocusSession(s, { completed: true });
    if (mission && mission.status !== "done") await setStatus(mission, "done");
    props.onFinished(min, mission ?? null);
  }

  return (
    <div className="mx-auto flex max-w-read flex-col items-center gap-8 py-4">
      <div className="text-center">
        <p className="eyebrow">{durationLabel(s.plannedMin)} block</p>
        <h1 className="mt-2 text-p1">{mission?.title ?? "Open focus"}</h1>
      </div>

      <FocusRing fraction={fraction} size={340}>
        <span className="tnum text-timer" role="timer" aria-live="off" aria-label={`${countdown} left`}>
          {countdown}
        </span>
        <span className="mt-2 text-sm font-medium text-ink-2">left</span>
      </FocusRing>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-secondary min-h-[52px] px-6" onClick={() => void pause()}>
          <PauseIcon size={18} /> Pause
        </button>
        <button type="button" className="btn-accent min-h-[52px] px-6" onClick={() => void done()}>
          <CheckIcon size={18} strokeWidth={2.25} /> Done
        </button>
        {mission && (
          <button type="button" className="btn-secondary min-h-[52px] px-6" onClick={() => setStuck(true)}>
            <StuckIcon size={18} /> Stuck
          </button>
        )}
      </div>

      {mission?.resumeNote && (
        <div className="card w-full">
          <p className="text-sm font-semibold text-ink-2">Resume note</p>
          <p className="mt-1">{mission.resumeNote}</p>
        </div>
      )}
      {mission?.minimum && (
        <p className="text-sm text-ink-2">
          <span className="font-semibold">Minimum · </span>
          {mission.minimum}
        </p>
      )}
      {mission && <StuckSheet mission={mission} open={stuck} onClose={() => setStuck(false)} />}
    </div>
  );
}

// ---------- after ----------

function AfterBlock(props: { minutes: number; mission: Mission | null; onDone: () => void }) {
  const m = props.mission;
  const toast = useToast();
  const [asked, setAsked] = useState(m == null || m.status === "done");

  async function mark(status: "done" | "minimum") {
    if (m) await setStatus(m, status);
    toast(status === "done" ? "Done. That's the block." : "Minimum counts. Half credit, full respect.");
    setAsked(true);
  }

  return (
    <div className="page-read">
      <div className="card flex flex-col items-start gap-3">
        <span className="icon-btn pointer-events-none h-14 w-14 bg-lime text-on-accent" aria-hidden="true">
          <CheckIcon size={26} strokeWidth={2.25} />
        </span>
        <h1 className="text-title-sm">Block complete.</h1>
        <p className="text-ink-2">
          <span className="tnum font-semibold text-ink">{props.minutes}</span> minutes{m ? ` on ${m.title}` : ""}.
        </p>
        {!asked && m && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm font-medium">How did it land?</span>
            <button type="button" className="chip bg-lime text-on-accent" onClick={() => void mark("done")}>
              <CheckIcon size={16} /> Done
            </button>
            <button type="button" className="chip hatch-min text-on-accent" onClick={() => void mark("minimum")}>
              Minimum
            </button>
            <button type="button" className="chip bg-surface-2 font-medium" onClick={() => setAsked(true)}>
              Not yet
            </button>
          </div>
        )}
        <Kural n={616} size="sm" className="mt-2" />
      </div>
      <RechargeMenu onDone={props.onDone} />
    </div>
  );
}

