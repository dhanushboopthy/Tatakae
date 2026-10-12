// TODO(v1, docs/11 §1): Web Dashboard (bento, ref 05): greeting + date pill; row 1 P1HeroCard · today score · screen StripeTrend · inbox box; row 2 P2/P3 · habits; row 3 SegmentGauge · goal RingProgress (v2).
import { Link } from "react-router-dom";
import { addDays, type Mark } from "@tatakae/core";
import { DaysShownUp } from "../components/DaysShownUp";
import { HabitStrip } from "../components/HabitStrip";
import { MoonIcon } from "../components/icons";
import { MissionCard } from "../components/MissionCard";
import { FORGE_PROBLEM_COPY, P1Card, P1QuickPlan } from "../components/P1Card";
import { useToast } from "../components/Toast";
import { forge, useDay, useIstTime, useSettings, useToday } from "../lib/hooks";
import { formatDay } from "../lib/format";
import { shouldPromptRitual } from "../lib/plan";

// Today (read-mostly on laptop): P1–P3 + side quest with chips, lock rules, habits, days shown up.
// No score before shutdown: it appears only once the day is closed (tomorrow locked or day past).

const MARK_COPY: Record<Mark, string> = {
  Strong: "Strong day.",
  Solid: "Solid day.",
  Light: "Light day. It still counts that you closed it.",
  Unplanned: "Nothing was planned.",
};

export function Today() {
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const now = useIstTime();
  const toast = useToast();
  const { data: day } = useDay(today);
  const { data: next } = useDay(tomorrow);
  const { data: settings } = useSettings();

  const ritualPrompt =
    settings && next && shouldPromptRitual({ nowHHMM: now, ritualTime: settings.ritual_time, tomorrowForged: next.forged });

  const ranked = day?.missions.filter((m) => m.slot !== "side") ?? [];
  const p1 = day?.slots.P1;
  const others = day ? (["P2", "P3", "side"] as const).map((s) => day.slots[s]).filter((m) => m !== undefined) : [];

  async function lockToday() {
    const problems = await forge(today);
    if (problems.length > 0) toast(problems.map((p) => FORGE_PROBLEM_COPY[p]).join(" "));
    else toast("Today's plan is locked.");
  }

  return (
    <div className="mx-auto max-w-read space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Today</h1>
          <p className="text-legacy-muted">{formatDay(today, { long: true })}</p>
        </div>
        <DaysShownUp />
      </header>

      {ritualPrompt && (
        <Link
          to="/ritual"
          className="flex min-h-tap items-center gap-3 rounded-legacy-card border border-legacy-ember bg-legacy-ember-soft px-4 py-3 hover:border-legacy-paper"
        >
          <MoonIcon className="shrink-0 text-legacy-ember" />
          <span className="flex-1">
            <span className="font-medium">Ritual time.</span> Close today and lock tomorrow — about five minutes.
          </span>
          <span className="text-sm text-legacy-muted">Start</span>
        </Link>
      )}

      {!day ? (
        <p className="text-legacy-muted">Opening…</p>
      ) : ranked.length === 0 ? (
        <section aria-labelledby="no-plan" className="space-y-4">
          <h2 id="no-plan">No plan locked. Pick one Minimum now.</h2>
          <P1QuickPlan date={today} onDone={() => toast("P1 locked. One mission — that's the whole plan.")} />
        </section>
      ) : (
        <>
          {!day.forged && (
            <div className="flex flex-wrap items-center gap-3 rounded-legacy-card border border-dashed border-legacy-line-strong p-4 text-sm">
              <p className="flex-1">This plan isn't locked yet. Lock it so changes need a reason.</p>
              <button type="button" className="btn-secondary" onClick={() => void lockToday()}>
                Lock today's plan
              </button>
            </div>
          )}

          {p1 && <P1Card mission={p1} forged={day.forged} />}
          {!p1 && <p className="text-legacy-muted">No P1 today.</p>}

          {others.length > 0 && (
            <section aria-label="Other missions" className="space-y-4">
              {others.map((m) => (
                <MissionCard key={m.id} mission={m} forged={day.forged} />
              ))}
            </section>
          )}

          {day.closed && (
            <section aria-labelledby="score-title" className="card">
              <h2 id="score-title" className="text-base">
                Day closed
              </h2>
              <p className="mt-1">
                <span className="tnum text-2xl font-semibold">{day.score.final}</span>
                <span className="text-legacy-muted"> / 100 · </span>
                {MARK_COPY[day.score.mark]}
              </p>
              {day.score.bonus > 0 && <p className="mt-1 text-sm text-legacy-muted">Includes +{day.score.bonus} for coming back.</p>}
            </section>
          )}
        </>
      )}

      <HabitStrip date={today} />
    </div>
  );
}
