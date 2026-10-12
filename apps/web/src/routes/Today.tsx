import { Link } from "react-router-dom";
import { addDays, formatIsoWeek, isoWeek, isoWeekRange, type MetricBox } from "@tatakae/core";
import { HabitStrip } from "../components/HabitStrip";
import { HatchedStackBar } from "../components/HatchedStackBar";
import { InboxIcon, LockIcon, MoonIcon, OpenIcon } from "../components/icons";
import { MetricCard } from "../components/MetricCard";
import { MissionCard } from "../components/MissionCard";
import { FORGE_PROBLEM_COPY, P1Card, P1QuickPlan } from "../components/P1Card";
import { PageHeader } from "../components/PageHeader";
import { RingProgress } from "../components/RingProgress";
import { SegmentGauge } from "../components/SegmentGauge";
import { StripeLegend, StripeTrend, stripeSummary } from "../components/StripeTrend";
import { useToast } from "../components/Toast";
import { AREA_COLORS, isAreaColor } from "../lib/colors";
import { formatDay } from "../lib/format";
import {
  forge,
  useAreas,
  useCycleStats,
  useDay,
  useInbox,
  useIstTime,
  useScoreboard,
  useSeries,
  useSettings,
  useToday,
  useWeekStats,
} from "../lib/hooks";
import { AFTER_P1, shouldPromptRitual } from "../lib/plan";
import { greeting, useDisplayName } from "../lib/profile";

// Web Dashboard (docs/10 §6, docs/11 §1, ref 05): greeting + week pill; bento grid —
// row 1 P1 hero · today's score · days shown up; row 2 P2…P9 / side quest · habits + inbox;
// row 3 screen-minutes stripe · 7-day average · focus this week; row 4 week bars · cycle gauge · goal rings.
// No score before shutdown: today's box says "Shown after shutdown" until the day is closed.

const box = (boxes: readonly MetricBox[] | undefined, key: MetricBox["key"]) => boxes?.find((b) => b.key === key);

export function Today() {
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const now = useIstTime();
  const toast = useToast();
  const name = useDisplayName();
  const { data: day } = useDay(today);
  const { data: next } = useDay(tomorrow);
  const { data: settings } = useSettings();
  const { data: boxes } = useScoreboard();
  const { data: screen } = useSeries("screen_min", 14);
  const week = isoWeek(today);
  const { data: weekStats } = useWeekStats(week);
  const { data: cycle } = useCycleStats();
  const { data: inbox = [] } = useInbox();
  const { data: areas = [] } = useAreas();

  const ritualPrompt =
    settings && next && shouldPromptRitual({ nowHHMM: now, ritualTime: settings.ritual_time, tomorrowForged: next.forged });
  const { start: ws, end: we } = isoWeekRange(week.year, week.week);
  const ranked = day?.missions.filter((m) => m.slot !== "side") ?? [];
  const p1 = day?.slots.P1;
  const others = day ? AFTER_P1.map((s) => day.slots[s]).filter((m) => m !== undefined) : [];
  const weekIndex = cycle ? cycle.weeks.findIndex((w) => today >= w.start && today <= w.end) + 1 : 0;

  async function lockToday() {
    const problems = await forge(today);
    if (problems.length > 0) toast(problems.map((p) => FORGE_PROBLEM_COPY[p]).join(" "));
    else toast("Today's plan is locked.");
  }

  const todayBox = box(boxes, "today_score");
  const shownBox = box(boxes, "days_shown_up");
  const avgBox = box(boxes, "avg_7d");
  const focusBox = box(boxes, "focus_week");

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            {formatDay(today, { long: true })}
            {cycle && weekIndex > 0 ? ` · Cycle ${cycle.index}, week ${weekIndex}` : ""}
          </>
        }
        title={greeting(now, name)}
        actions={
          <Link to={`/review/week?w=${formatIsoWeek(week)}`} className="btn-primary hidden sm:inline-flex">
            {formatDay(ws).replace(/^\w+ /, "")} – {formatDay(we).replace(/^\w+ /, "")}
          </Link>
        }
      />

      {ritualPrompt && (
        <Link to="/ritual" className="flex items-center gap-4 rounded-card bg-lavender-soft p-4 pr-5 transition hover:brightness-[0.98]">
          <span className="icon-btn pointer-events-none bg-lavender text-on-accent" aria-hidden="true">
            <MoonIcon />
          </span>
          <span className="flex-1">
            <span className="font-semibold">Ritual time.</span> Close today and lock tomorrow — about five minutes.
          </span>
          <span className="btn-primary">Start</span>
        </Link>
      )}

      {!day ? (
        <p className="text-ink-2">Opening…</p>
      ) : (
        <>
          {/* Row 1 */}
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              {ranked.length === 0 ? (
                <section aria-labelledby="no-plan" className="card h-full space-y-4">
                  <h2 id="no-plan" className="text-xl">
                    No plan locked. Pick one Minimum now.
                  </h2>
                  <P1QuickPlan date={today} onDone={() => toast("P1 locked. One mission — that's the whole plan.")} />
                </section>
              ) : p1 ? (
                <P1Card mission={p1} forged={day.forged} />
              ) : (
                <section className="card h-full">
                  <p className="text-ink-2">No P1 today.</p>
                </section>
              )}
            </div>
            {todayBox && <MetricCard box={todayBox} size="lg" />}
            {shownBox && <MetricCard box={shownBox} size="lg" to="/cycle" bar="lime" />}
          </div>

          {ranked.length > 0 && !day.forged && (
            <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 pl-5 text-sm">
              <LockIcon size={18} />
              <p className="flex-1">This plan isn't locked yet. Lock it so changes need a reason.</p>
              <button type="button" className="btn-secondary" onClick={() => void lockToday()}>
                Lock today's plan
              </button>
            </div>
          )}

          {/* Row 2 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {others.map((m) => (
              <MissionCard key={m.id} mission={m} forged={day.forged} />
            ))}
            <div className={`flex flex-col gap-4 ${others.length === 0 ? "lg:col-span-2" : ""}`}>
              <HabitStrip date={today} title="Habits today" />
              <Link to="/inbox" className="card flex items-center justify-between gap-3 transition hover:bg-surface/80">
                <span className="flex items-center gap-3">
                  <span className="icon-btn pointer-events-none" aria-hidden="true">
                    <InboxIcon />
                  </span>
                  <span>
                    <span className="block font-semibold">Inbox</span>
                    <span className="block text-sm text-ink-2">{box(boxes, "inbox")?.context ?? ""}</span>
                  </span>
                </span>
                <span className="tnum text-title-sm">{inbox.length}</span>
              </Link>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid gap-4 lg:grid-cols-4">
            <section aria-labelledby="screen-title" className="card space-y-3 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="screen-title" className="text-base font-semibold">
                    Screen minutes · 14 days
                  </h2>
                  <p className="tnum mt-1 text-hero-sm">
                    {screen?.average ?? "—"} <span className="text-base font-medium tracking-normal text-ink-2">avg / day</span>
                  </p>
                </div>
                <StripeLegend free={settings?.scoring.screenFreeMin} />
              </div>
              {screen && (
                <StripeTrend
                  points={screen.points}
                  today={today}
                  free={settings?.scoring.screenFreeMin}
                  label={stripeSummary(screen.points, settings?.scoring.screenFreeMin)}
                />
              )}
              <p className="text-[13px] text-ink-2">{screen ? stripeSummary(screen.points, settings?.scoring.screenFreeMin) : ""}</p>
            </section>
            {avgBox && <MetricCard box={avgBox} to="/review/week" bar="lavender" />}
            {focusBox && <MetricCard box={focusBox} to="/calendar" />}
          </div>

          {/* Row 4 */}
          <div className="grid gap-4 lg:grid-cols-4">
            <section aria-labelledby="week-title" className="card space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h2 id="week-title" className="text-base font-semibold">
                  This week
                </h2>
                <Link to="/review/week" className="icon-btn-sm" aria-label="Open the weekly review">
                  <OpenIcon size={18} />
                </Link>
              </div>
              {weekStats && <HatchedStackBar days={weekStats.days} today={today} summary={weekStats.summary} />}
            </section>

            <section aria-labelledby="cycle-title" className="card flex flex-col items-center gap-2">
              <div className="flex w-full items-center justify-between">
                <h2 id="cycle-title" className="text-base font-semibold">
                  Cycle {cycle?.index ?? 1} · {cycle?.weeks.length ?? 12} weeks
                </h2>
                <Link to="/cycle" className="icon-btn-sm" aria-label="Open the cycle">
                  <OpenIcon size={18} />
                </Link>
              </div>
              {cycle && (
                <>
                  <SegmentGauge
                    marks={cycle.weekMarks}
                    pct={cycle.pct}
                    word={cycle.word}
                    label={`Cycle gauge: ${cycle.daysShownUp} of ${cycle.daysElapsed} days shown up; ${cycle.word}.`}
                  />
                  <p className="self-start text-[13px] text-ink-2">
                    {formatDay(cycle.start).replace(/^\w+ /, "")} – {formatDay(cycle.end).replace(/^\w+ /, "")}
                    {weekIndex > 0 ? ` · week ${weekIndex} of ${cycle.weeks.length}` : ""}
                  </p>
                </>
              )}
            </section>

            <section aria-labelledby="goals-title" className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="goals-title" className="text-base font-semibold">
                  Cycle goals
                </h2>
                <Link to="/cycle" className="link text-sm">
                  View all
                </Link>
              </div>
              {cycle && cycle.goals.length > 0 ? (
                <ul className="space-y-3">
                  {cycle.goals.slice(0, 4).map((g) => {
                    const area = areas.find((a) => a.id === g.areaId);
                    const deep = isAreaColor(g.color) ? AREA_COLORS[g.color].deep : "#7E9A1E";
                    return (
                      <li key={g.id} className="flex items-center gap-3.5">
                        <RingProgress pct={g.progressPct} color={deep} label={`${g.name}: ${g.progressPct} percent`} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{g.name}</span>
                          <span className="tnum block text-[13px] text-ink-2">
                            {area ? `${area.name} · ` : ""}
                            {g.target ? `${g.earned} of ${g.target} pts` : `${g.earned} pts`}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">
                  No goals for this cycle yet.{" "}
                  <Link to="/cycle" className="link">
                    Set up to four
                  </Link>
                  .
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
