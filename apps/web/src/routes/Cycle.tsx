import { useState, type FormEvent } from "react";
import { MAX_ACTIVE_GOALS, addDays, type CalendarDay, type Goal, type GoalProgress, type GoalStatus } from "@tatakae/core";
import { DayCircle } from "../components/DayCircle";
import { PencilIcon, PlusIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { PageHeader } from "../components/PageHeader";
import { RingProgress } from "../components/RingProgress";
import { SegmentGauge } from "../components/SegmentGauge";
import { useToast } from "../components/Toast";
import { AREA_COLORS, isAreaColor } from "../lib/colors";
import { formatDay } from "../lib/format";
import { removeGoal, saveGoal, useAreas, useCalendarMonth, useCycleStats, useExperiments, useGoals, useToday } from "../lib/hooks";
import { ExperimentCard } from "./WeeklyReview";

// Cycle (docs/02, docs/11 C4/C5, ref 04): big 12-segment gauge, goal rings (max 4 active, each passed
// the hell-yeah gate), the cycle calendar (12 weeks × 7 circles) and the experiment log.

const STATUS_LABEL: Record<GoalStatus, string> = { active: "Active", paused: "Paused", done: "Done", dropped: "Dropped" };

export function Cycle() {
  const today = useToday();
  const { data: cycle } = useCycleStats();
  const weekIndex = cycle ? cycle.weeks.findIndex((w) => today >= w.start && today <= w.end) + 1 : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow={cycle ? `${formatDay(cycle.start).replace(/^\w+ /, "")} – ${formatDay(cycle.end).replace(/^\w+ /, "")}${weekIndex ? ` · week ${weekIndex} of ${cycle.weeks.length}` : ""}` : "Cycle"}
        title={`Cycle ${cycle?.index ?? 1}`}
      />
      <Kural n={595} className="max-w-read" />
      {cycle && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="gauge-title" className="card flex flex-col items-center gap-3">
            <h2 id="gauge-title" className="self-start text-base font-semibold">
              Days shown up
            </h2>
            <SegmentGauge
              animate
              size={440}
              marks={cycle.weekMarks}
              pct={cycle.pct}
              word={cycle.word}
              label={`Cycle gauge: ${cycle.daysShownUp} of ${cycle.daysElapsed} days shown up; weeks: ${cycle.weekMarks.join(", ")}.`}
            />
            <p className="tnum self-start text-sm text-ink-2">
              {cycle.daysShownUp} of {cycle.daysElapsed} days so far. Rest and write-off days don't count against you.
            </p>
          </section>
          <Goals progress={cycle.goals} />
        </div>
      )}
      {cycle && <CycleCalendar start={cycle.start} end={cycle.end} today={today} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <ExperimentCard today={today} />
        <ExperimentLog />
      </div>
    </div>
  );
}

function Goals({ progress }: { progress: readonly GoalProgress[] }) {
  const { data: goals = [] } = useGoals();
  const { data: areas = [] } = useAreas();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const live = goals.filter((g) => g.status !== "dropped");
  const active = goals.filter((g) => g.status === "active").length;

  return (
    <section aria-labelledby="goals-title" className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="goals-title" className="text-base font-semibold">
            Cycle goals
          </h2>
          <p className="tnum text-sm text-ink-2">
            {active} of {MAX_ACTIVE_GOALS} active
          </p>
        </div>
        {editing === null && (
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add goal
          </button>
        )}
      </div>
      {editing !== null && <GoalForm goal={editing === "new" ? null : editing} activeCount={active} onDone={() => setEditing(null)} />}
      {live.length === 0 && editing === null ? (
        <p className="text-sm text-ink-2">Up to four goals for twelve weeks. Each has to be a hell yeah.</p>
      ) : (
        <ul className="space-y-3">
          {live.map((g) => {
            const p = progress.find((x) => x.id === g.id);
            const area = areas.find((a) => a.id === g.areaId);
            const deep = isAreaColor(area?.color) ? AREA_COLORS[area.color].deep : "#7E9A1E";
            return (
              <li key={g.id} className="flex items-center gap-3.5 rounded-card-inner bg-surface-2 p-3">
                <RingProgress pct={p?.progressPct ?? 0} color={deep} label={`${g.name}: ${p?.progressPct ?? 0} percent`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="tnum text-[13px] text-ink-2">
                    {[area?.name, p ? (p.target ? `${p.earned} of ${p.target} pts` : `${p.earned} pts`) : null, g.nextAction && `Next: ${g.nextAction}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className={`pill ${g.status === "active" ? "bg-lime text-on-accent" : "bg-surface text-ink-2"}`}>{STATUS_LABEL[g.status]}</span>
                <button type="button" className="icon-btn-sm bg-surface" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
                  <PencilIcon size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GoalForm({ goal, activeCount, onDone }: { goal: Goal | null; activeCount: number; onDone: () => void }) {
  const toast = useToast();
  const { data: areas = [] } = useAreas();
  const [f, setF] = useState({
    name: goal?.name ?? "",
    areaId: goal?.areaId ?? "",
    intent: goal?.intent ?? "",
    outcome: goal?.outcome ?? "",
    niceGoal: goal?.niceGoal ?? "",
    nextAction: goal?.nextAction ?? "",
    why: goal?.why ?? "",
    targetPoints: goal?.targetPoints != null ? String(goal.targetPoints) : "",
  });
  const [hellYeah, setHellYeah] = useState(goal?.hellYeah ?? false);
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "active");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const wasActive = goal?.status === "active";
  const full = !wasActive && activeCount >= MAX_ACTIVE_GOALS;
  const problem =
    status === "active" && !hellYeah
      ? "An active goal has to be a hell yeah. Pause it, or tick the box if it really is."
      : status === "active" && full
        ? `Four goals are already active. Pause or finish one first.`
        : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || problem) return;
    const n = (v: string) => v.trim() || null;
    const tp = Number.parseInt(f.targetPoints, 10);
    await saveGoal({
      id: goal?.id,
      name: f.name.trim(),
      areaId: f.areaId || null,
      status,
      intent: n(f.intent),
      outcome: n(f.outcome),
      niceGoal: n(f.niceGoal),
      nextAction: n(f.nextAction),
      why: n(f.why),
      hellYeah,
      targetPoints: Number.isFinite(tp) && tp > 0 ? tp : null,
      start: goal?.start ?? null,
      end: goal?.end ?? null,
    });
    toast(goal ? "Goal saved." : "Goal added.");
    onDone();
  }

  const field = (k: keyof typeof f, label: string, hint?: string) => (
    <div>
      <label htmlFor={`g-${k}`} className="label">
        {label}
      </label>
      <input id={`g-${k}`} className="input" maxLength={500} value={f[k]} onChange={set(k)} placeholder={hint} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="card-inner space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="g-name" className="label">
            Goal
          </label>
          <input id="g-name" className="input" autoFocus maxLength={200} value={f.name} onChange={set("name")} />
        </div>
        <div>
          <label htmlFor="g-area" className="label">
            Area
          </label>
          <select id="g-area" className="input" value={f.areaId} onChange={set("areaId")}>
            <option value="">None</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {field("intent", "Intent", "What you're going for")}
      {field("outcome", "Outcome", "How you'll know it happened")}
      {field("niceGoal", "Nice-to-have", "The stretch version")}
      {field("why", "Why")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("nextAction", "Next physical action")}
        <div>
          <label htmlFor="g-target" className="label">
            Target points (ring)
          </label>
          <input id="g-target" className="input tnum" inputMode="numeric" value={f.targetPoints} onChange={(e) => setF((s) => ({ ...s, targetPoints: e.target.value.replace(/[^\d]/g, "") }))} />
        </div>
      </div>
      <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-card-inner bg-surface p-3">
        <input type="checkbox" className="h-5 w-5 accent-[#7E9A1E]" checked={hellYeah} onChange={(e) => setHellYeah(e.target.checked)} />
        <span>
          <span className="font-semibold">Hell yeah.</span> <span className="text-sm text-ink-2">Not a should — you'd be gutted not to do it.</span>
        </span>
      </label>
      <fieldset>
        <legend className="label">Status</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABEL) as GoalStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`chip ${status === s ? "bg-charcoal text-on-charcoal" : "bg-surface font-medium"}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        {goal ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await removeGoal(goal.id);
              onDone();
            }}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!f.name.trim() || problem !== null}>
            Save goal
          </button>
        </div>
      </div>
    </form>
  );
}

/** 12 rows (weeks) × 7 day circles across the cycle. */
function CycleCalendar({ start, end, today }: { start: string; end: string; today: string }) {
  const months = [...new Set(Array.from({ length: 84 }, (_, i) => addDays(start, i).slice(0, 7)))];
  return (
    <section aria-labelledby="cc-title" className="card space-y-3">
      <h2 id="cc-title" className="text-base font-semibold">
        Twelve weeks
      </h2>
      <CycleGrid months={months} start={start} end={end} today={today} />
    </section>
  );
}

function CycleGrid({ months, start, end, today }: { months: string[]; start: string; end: string; today: string }) {
  // One query per month (at most 4), then lay out week rows.
  const a = useCalendarMonth(months[0] ?? start.slice(0, 7)).data ?? [];
  const b = useCalendarMonth(months[1] ?? months[0] ?? start.slice(0, 7)).data ?? [];
  const c = useCalendarMonth(months[2] ?? months[0] ?? start.slice(0, 7)).data ?? [];
  const d = useCalendarMonth(months[3] ?? months[0] ?? start.slice(0, 7)).data ?? [];
  const byDate = new Map<string, CalendarDay>([...a, ...b, ...c, ...d].map((x) => [x.date, x] as const));
  const weeks: string[][] = [];
  for (let w = 0; w * 7 < 84; w++) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)).filter((x) => x <= end));
  return (
    <ol className="grid gap-x-6 gap-y-2 md:grid-cols-2" aria-label="Cycle days by week">
      {weeks.map((days, i) => (
        <li key={days[0]} className="flex items-center gap-2">
          <span className={`tnum w-10 shrink-0 text-xs font-semibold ${days.includes(today) ? "text-ink" : "text-ink-2"}`}>W{i + 1}</span>
          <span className="flex gap-1.5">
            {days.map((day) => {
              const cd = byDate.get(day);
              return cd ? <DayCircle key={day} date={day} state={cd.state} hasNote={cd.hasNote} final={cd.final} size={30} /> : null;
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ExperimentLog() {
  const { data: experiments = [] } = useExperiments();
  return (
    <section aria-labelledby="log-title" className="card space-y-3">
      <h2 id="log-title" className="text-lg font-semibold">
        Experiment log
      </h2>
      {experiments.length === 0 ? (
        <p className="text-sm text-ink-2">No experiments yet. Start one in the weekly review.</p>
      ) : (
        <ul className="space-y-2">
          {experiments.map((e) => (
            <li key={e.id} className="card-inner text-sm">
              <p className="font-semibold">{e.change}</p>
              <p className="text-ink-2">
                {formatDay(e.start)} – {formatDay(e.end)} · expected: {e.hypothesis}
              </p>
              {e.result && <p className="mt-1">Result: {e.result}</p>}
              <p className="mt-1 font-medium">{e.decision ? `Decision: ${e.decision}` : "Running"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
