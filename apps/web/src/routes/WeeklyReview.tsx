import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  addDays,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  parseIsoWeek,
  slotRank,
  type Experiment,
  type ISODate,
  type MetricBox,
  type Review,
  type WeekStats,
} from "@tatakae/core";
import { AreaBlock } from "../components/AreaBlock";
import { HatchedStackBar } from "../components/HatchedStackBar";
import { ChevronLeftIcon, ChevronRightIcon, OpenIcon } from "../components/icons";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { PillBar } from "../components/PillBar";
import { ReviewField, ReviewSwitch, Scale, StepCard } from "../components/ReviewParts";
import { Sparkline } from "../components/Sparkline";
import { StripeTrend, stripeSummary } from "../components/StripeTrend";
import { useToast } from "../components/Toast";
import { areaColor } from "../lib/colors";
import { formatDay, weekdayInitial } from "../lib/format";
import {
  saveExperiment,
  saveReview,
  useAreas,
  useCapacityRange,
  useExperiments,
  useGoals,
  useMissionsRange,
  useMuraEvents,
  useReviews,
  useScoreSeries,
  useSettings,
  useToday,
  useWeekStats,
  type ReviewFields,
} from "../lib/hooks";

// Weekly Control Room (docs/02 Sunday review, docs/10 §6, ref 06): cream canvas; stats first, then
// Muri (overload) → Mura (unevenness: lock-edit reasons, stuck) → Muda (waste: screen minutes, missions
// moved twice) → one experiment for two weeks → plan the week. Completing it unlocks a reward episode.

const STUCK_COLORS = {
  uncertainty: { fill: "#B9CBF0", deep: "#4E6FB5" },
  fear: { fill: "#A9A3DB", deep: "#6E66B8" },
  inertia: { fill: "#CDE37A", deep: "#7E9A1E" },
};

export function WeeklyReview() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const week = parseIsoWeek(params.get("w") ?? "") ?? isoWeek(today);
  const { start, end } = isoWeekRange(week.year, week.week);
  const { data: stats } = useWeekStats(week);
  const { data: reviews = [] } = useReviews();
  const existing = reviews.find((r) => r.type === "week" && r.periodStart === start) ?? null;
  const go = (n: number) => setParams({ w: formatIsoWeek(isoWeek(addDays(start, n * 7))) }, { replace: true });

  return (
    <div className="-mx-4 -my-6 bg-canvas-cream px-4 py-6 md:-mx-8 md:-my-8 md:px-8 md:py-8 lg:-mx-10 lg:px-10">
      <div className="page">
        <PageHeader
          eyebrow={`Week ${week.week} · ${formatDay(start).replace(/^\w+ /, "")} – ${formatDay(end).replace(/^\w+ /, "")}`}
          title="Weekly Control Room"
          actions={
            <>
              <button type="button" className="icon-btn bg-surface" aria-label="Previous week" onClick={() => go(-1)}>
                <ChevronLeftIcon />
              </button>
              <button type="button" className="icon-btn bg-surface" aria-label="Next week" onClick={() => go(1)}>
                <ChevronRightIcon />
              </button>
              <ReviewSwitch value="week" />
            </>
          }
        />
        {stats ? (
          <>
            <WeekScoreboard stats={stats} />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <WeekColumns start={start} end={end} today={today} />
              <div className="space-y-4">
                <section aria-labelledby="bars-title" className="card space-y-3">
                  <h2 id="bars-title" className="text-base font-semibold">
                    Points per day
                  </h2>
                  <HatchedStackBar days={stats.days} today={today} summary={stats.summary} height={150} />
                </section>
                <TrendCards end={end} />
              </div>
            </div>
            <ReviewForm key={existing?.id ?? start} start={start} end={end} stats={stats} existing={existing} />
          </>
        ) : (
          <p className="text-ink-2">Opening…</p>
        )}
      </div>
    </div>
  );
}

function WeekScoreboard({ stats }: { stats: WeekStats }) {
  const closed = stats.days.filter((d) => d.final != null);
  const shown = stats.days.filter((d) => d.state === "Strong" || d.state === "Solid" || d.state === "Light").length;
  const boxes: MetricBox[] = [
    { key: "avg_7d", label: "Average score", value: stats.average, unit: "", delta: null, target: 80, progress: stats.average, context: stats.summary },
    {
      key: "days_shown_up",
      label: "Days shown up",
      value: shown,
      unit: "",
      delta: null,
      target: closed.length || null,
      progress: closed.length ? Math.round((100 * shown) / closed.length) : null,
      context: `of ${closed.length} closed ${closed.length === 1 ? "day" : "days"}`,
    },
    { key: "focus_week", label: "Focus", value: stats.focusMinutes, unit: "min", delta: null, target: null, progress: null, context: `${stats.areaMinutes.length} areas` },
    { key: "habits_week", label: "Habits", value: stats.habitsPct, unit: "%", delta: null, target: 100, progress: stats.habitsPct, context: "of due checks" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {boxes.map((b, i) => (
        <MetricCard key={b.key} box={b} bar={i % 2 ? "lavender" : "lime"} />
      ))}
    </div>
  );
}

/** Left: week columns with what was planned, as area blocks (ref 06). */
function WeekColumns({ start, end, today }: { start: ISODate; end: ISODate; today: ISODate }) {
  const { data: missions = [] } = useMissionsRange(start, end);
  const { data: areas = [] } = useAreas();
  const { data: goals = [] } = useGoals();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const areaOf = (goalId: string | null) => {
    const g = goals.find((x) => x.id === goalId);
    const i = areas.findIndex((a) => a.id === g?.areaId);
    return i >= 0 ? { area: areas[i] ?? null, color: areaColor(areas[i], i) } : null;
  };
  const STATUS: Record<string, string> = { done: "Done", minimum: "Minimum", missed: "Missed", open: "Open", rescheduled: "Moved", backlog: "" };
  return (
    <section aria-labelledby="planned-title" className="card min-w-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="planned-title" className="text-base font-semibold">
          What was planned
        </h2>
        <Link to="/calendar?view=week" className="icon-btn-sm" aria-label="Open the week planner">
          <OpenIcon size={18} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-2">
          {dates.map((d) => {
            const ms = missions
              .filter((m) => m.dayDate === d)
              .sort((a, b) => slotRank(a.slot) - slotRank(b.slot));
            return (
              <div key={d} className="space-y-2">
                <p className="text-center text-[13px] font-semibold">
                  {weekdayInitial(d)}{" "}
                  <span className={`tnum inline-flex h-7 w-7 items-center justify-center rounded-full ${d === today ? "bg-charcoal text-on-charcoal" : "text-ink-2"}`}>
                    {Number(d.slice(8))}
                  </span>
                </p>
                {ms.length === 0 && <p className="rounded-[14px] bg-surface-2 p-2 text-center text-xs text-ink-2">—</p>}
                {ms.map((m) => {
                  const a = areaOf(m.goalId);
                  return (
                    <div key={m.id} className={m.status === "rescheduled" ? "opacity-60" : ""}>
                      <AreaBlock
                        compact
                        tag={a?.area?.name ?? (m.slot === "side" ? "Side" : m.slot)}
                        title={m.title}
                        time={STATUS[m.status]}
                        fill={a ? a.color.fill : m.slot === "P1" ? "#CDE37A" : m.slot === "P2" ? "#A9A3DB" : "#EEF5D3"}
                        deep={a ? a.color.deep : "#7E9A1E"}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrendCards({ end }: { end: ISODate }) {
  const { data: scores } = useScoreSeries(30);
  const { data: settings } = useSettings();
  const { data: stats } = useWeekStats(isoWeek(end));
  const free = settings?.scoring.screenFreeMin ?? 120;
  return (
    <>
      {scores && (
        <section aria-labelledby="spark-title" className="card space-y-2">
          <h2 id="spark-title" className="text-base font-semibold">
            Score · 30 days
          </h2>
          <Sparkline points={scores.points} avg7={scores.avg7} label={scores.summary} />
          <p className="text-[13px] text-ink-2">{scores.summary} Lime line: 7-day average.</p>
        </section>
      )}
      {stats && (
        <section aria-labelledby="screen-w-title" className="card space-y-2">
          <h2 id="screen-w-title" className="text-base font-semibold">
            Screen minutes · this week
          </h2>
          <StripeTrend
            points={stats.days.map((d) => ({ date: d.date, value: d.screenMin }))}
            today={end}
            free={free}
            height={110}
            label={stripeSummary(
              stats.days.map((d) => ({ date: d.date, value: d.screenMin })),
              free,
            )}
          />
          <p className="text-[13px] text-ink-2">
            {stripeSummary(
              stats.days.map((d) => ({ date: d.date, value: d.screenMin })),
              free,
            )}
          </p>
        </section>
      )}
    </>
  );
}

function ReviewForm(props: { start: ISODate; end: ISODate; stats: WeekStats; existing: Review | null }) {
  const toast = useToast();
  const ex = props.existing;
  const { data: capacity = [] } = useCapacityRange(props.start, props.end);
  const { data: mura = [] } = useMuraEvents(props.start, props.end);
  const [f, setF] = useState({
    wins: ex?.wins ?? "",
    failed: ex?.failed ?? "",
    why: ex?.why ?? "",
    muri: ex?.muri ?? "",
    mura: ex?.mura ?? "",
    muda: ex?.muda ?? "",
    diagnosis: ex?.diagnosis ?? "",
    bottleneck: ex?.bottleneck ?? "",
    theme: ex?.theme ?? "",
  });
  const [scales, setScales] = useState({ capacity: ex?.capacity ?? null, burnout: ex?.burnout ?? null, capability: ex?.capability ?? null });
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const over = capacity.filter((c) => c.planned > c.budget && c.planned > 0);
  const s = props.stats;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = (v: string) => v.trim() || null;
    const fields: ReviewFields = {
      type: "week",
      periodStart: props.start,
      periodEnd: props.end,
      wins: n(f.wins),
      failed: n(f.failed),
      why: n(f.why),
      muri: n(f.muri),
      mura: n(f.mura),
      muda: n(f.muda),
      diagnosis: n(f.diagnosis),
      bottleneck: n(f.bottleneck),
      theme: n(f.theme),
      ...scales,
    };
    const show = await saveReview(fields, ex);
    if (show) setUnlocked(show);
    toast(ex ? "Review updated." : "Review complete. Rest well.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <StepCard step="1" title="Muri · overload" question="Did the plan ask for more than the time allowed?" tone="bg-area-butter">
          {over.length === 0 ? (
            <p className="text-sm">Every day stayed inside its capacity budget.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {over.map((c) => (
                <li key={c.date} className="flex justify-between gap-2">
                  <span>{formatDay(c.date)}</span>
                  <span className="tnum font-semibold">
                    {c.planned} / {c.budget} min
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ReviewField id="muri" label="What would you plan differently?" value={f.muri} onChange={set("muri")} rows={2} />
        </StepCard>
        <StepCard step="2" title="Mura · unevenness" question="Where did the plan wobble — lock edits and stuck moments." tone="bg-lavender">
          <PillBar
            label={`Stuck this week: ${s.stuck.uncertainty} uncertainty, ${s.stuck.fear} fear, ${s.stuck.inertia} inertia`}
            empty="No stuck moments logged."
            parts={[
              { label: "Uncertainty", value: s.stuck.uncertainty, ...STUCK_COLORS.uncertainty },
              { label: "Fear", value: s.stuck.fear, ...STUCK_COLORS.fear },
              { label: "Inertia", value: s.stuck.inertia, ...STUCK_COLORS.inertia },
            ]}
          />
          {mura.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {mura.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <span className="font-semibold">{m.title}:</span> {m.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No locked-plan edits.</p>
          )}
          <ReviewField id="mura" label="What made it uneven?" value={f.mura} onChange={set("mura")} rows={2} />
        </StepCard>
        <StepCard step="3" title="Muda · waste" question="What took time and gave nothing back?" tone="bg-area-sky">
          <p className="text-sm">
            Screen time averaged <span className="tnum font-semibold">{s.screenAvg ?? "—"}</span> min a day.
          </p>
          {s.rescheduledTwice.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {s.rescheduledTwice.map((m) => (
                <li key={m.id}>
                  <span className="font-semibold">{m.title}</span> — moved {m.count}×. Shrink it, or drop it.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Nothing was moved twice.</p>
          )}
          <ReviewField id="muda" label="What will you cut?" value={f.muda} onChange={set("muda")} rows={2} />
        </StepCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4" aria-label="Reflection">
          <ReviewField id="wins" label="Wins" value={f.wins} onChange={set("wins")} rows={2} />
          <ReviewField id="failed" label="Not this time" value={f.failed} onChange={set("failed")} rows={2} />
          <ReviewField id="why" label="Why" value={f.why} onChange={set("why")} rows={2} />
          <ReviewField id="diagnosis" label="Diagnosis" hint="One sentence: what's really going on?" value={f.diagnosis} onChange={set("diagnosis")} rows={2} />
          <ReviewField id="bottleneck" label="Bottleneck" value={f.bottleneck} onChange={set("bottleneck")} rows={1} />
        </section>
        <div className="space-y-4">
          <section className="card space-y-4" aria-label="Energy check">
            <Scale id="capacity" label="Capacity" value={scales.capacity} onChange={(v) => setScales((x) => ({ ...x, capacity: v }))} lowLabel="Empty" highLabel="Plenty" />
            <Scale id="burnout" label="Burnout" value={scales.burnout} onChange={(v) => setScales((x) => ({ ...x, burnout: v }))} lowLabel="Fresh" highLabel="Fried" />
            <Scale id="capability" label="Capability" value={scales.capability} onChange={(v) => setScales((x) => ({ ...x, capability: v }))} lowLabel="Out of depth" highLabel="Sharp" />
          </section>
          <ExperimentCard today={props.end} />
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-ink-2">
          {unlocked
            ? `Unlocked one episode of ${unlocked}. Enjoy it.`
            : ex
              ? "Saved. Edit anything and save again."
              : "Completing the review unlocks one episode from your reward queue."}
        </p>
        <Link to="/calendar?view=week" className="btn-secondary">
          Plan the week
        </Link>
        <button type="submit" className="btn-primary">
          {ex ? "Save review" : "Complete review"}
        </button>
      </div>
    </form>
  );
}

/** One experiment at a time, two weeks by default. Close the running one with a result and decision. */
export function ExperimentCard({ today }: { today: ISODate }) {
  const { data: experiments = [] } = useExperiments();
  const running = experiments.find((e) => e.decision == null && e.end >= today) ?? experiments.find((e) => e.decision == null);
  return (
    <section aria-labelledby="exp-title" className="card space-y-3">
      <h2 id="exp-title" className="text-lg font-semibold">
        Experiment
      </h2>
      {running ? <CloseExperiment key={running.id} exp={running} /> : <StartExperiment today={today} />}
    </section>
  );
}

function CloseExperiment({ exp }: { exp: Experiment }) {
  const toast = useToast();
  const [result, setResult] = useState(exp.result ?? "");
  const [decision, setDecision] = useState("");
  return (
    <div className="space-y-3">
      <div className="card-inner text-sm">
        <p className="font-semibold">{exp.hypothesis}</p>
        <p className="text-ink-2">
          Change: {exp.change} · {formatDay(exp.start)} – {formatDay(exp.end)}
        </p>
      </div>
      <ReviewField id="exp-result" label="Result so far" value={result} onChange={setResult} rows={2} />
      <div>
        <label htmlFor="exp-decision" className="label">
          Decision (keep, tweak, drop) — closes it
        </label>
        <input id="exp-decision" className="input" maxLength={500} value={decision} onChange={(e) => setDecision(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          await saveExperiment({ ...exp, result: result.trim() || null, decision: decision.trim() || null });
          toast(decision.trim() ? "Experiment closed." : "Result saved.");
        }}
      >
        {decision.trim() ? "Close experiment" : "Save result"}
      </button>
    </div>
  );
}

function StartExperiment({ today }: { today: ISODate }) {
  const toast = useToast();
  const [hypothesis, setHypothesis] = useState("");
  const [change, setChange] = useState("");
  const ok = hypothesis.trim() && change.trim();
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">One change for the next two weeks. Small enough to keep.</p>
      <div>
        <label htmlFor="exp-h" className="label">
          If I…
        </label>
        <input id="exp-h" className="input" maxLength={500} value={change} onChange={(e) => setChange(e.target.value)} placeholder="charge the phone in the hall" />
      </div>
      <div>
        <label htmlFor="exp-c" className="label">
          …then I expect
        </label>
        <input id="exp-c" className="input" maxLength={500} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="screen time under 120 on 5 of 7 days" />
      </div>
      <button
        type="button"
        className="btn-secondary"
        disabled={!ok}
        onClick={async () => {
          await saveExperiment({ hypothesis: hypothesis.trim(), change: change.trim(), start: addDays(today, 1), end: addDays(today, 14), result: null, decision: null });
          toast("Experiment starts tomorrow. Two weeks.");
        }}
      >
        Start experiment
      </button>
    </div>
  );
}
