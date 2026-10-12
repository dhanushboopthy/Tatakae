import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { monthRange, themeFor, type Area, type MonthStats, type Review } from "@tatakae/core";
import { BlockBarChart, CountBlocks, type BlockSeries } from "../components/BlockBarChart";
import { DayLegend } from "../components/DayCircle";
import { HabitHeatGrid } from "../components/HabitHeatGrid";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { SceneCard } from "../components/SceneCard";
import { DeltaPill } from "../components/MetricCard";
import { MonthCalendar } from "../components/MonthCalendar";
import { PageHeader } from "../components/PageHeader";
import { ReviewField, ReviewSwitch } from "../components/ReviewParts";
import { Sparkline } from "../components/Sparkline";
import { useToast } from "../components/Toast";
import { UNASSIGNED, areaColor } from "../lib/colors";
import { saveArea, saveReview, useAreas, useHabitGrid, useMonthStats, useMonthWeeks, useReviews, useScoreSeries, useToday } from "../lib/hooks";

// Monthly review (docs/02, docs/11 §1): month calendar heat, mark distribution, focus minutes by area
// per week, 30-day sparkline, habit grid, averages (rest / write-off excluded), area alignment, wins /
// not this time / why, next month's theme.

const monthTitle = (yyyymm: string) =>
  new Date(`${yyyymm}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyReview() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("m") ?? "") ? (params.get("m") as string) : today.slice(0, 7);
  const { data: stats } = useMonthStats(month);
  const { data: reviews = [] } = useReviews();
  const { start } = monthRange(month);
  const existing = reviews.find((r) => r.type === "month" && r.periodStart === start) ?? null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Monthly review"
        title={monthTitle(month)}
        actions={
          <>
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setParams({ m: shiftMonth(month, -1) }, { replace: true })}>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setParams({ m: shiftMonth(month, 1) }, { replace: true })}>
              <ChevronRightIcon />
            </button>
            <ReviewSwitch value="month" />
          </>
        }
      />
      <SceneCard scene="monthly" className="max-w-read" />
      {!stats ? (
        <p className="text-ink-2">Opening…</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <section aria-labelledby="avg-title" className="card space-y-2">
              <h2 id="avg-title" className="text-base font-semibold">
                Average score
              </h2>
              <p className="flex items-baseline gap-2">
                <span className="tnum text-hero">{stats.average ?? "—"}</span>
                <DeltaPill delta={stats.average != null && stats.previousAverage != null ? stats.average - stats.previousAverage : null} />
              </p>
              <p className="text-sm text-ink-2">
                {stats.previousAverage != null ? `Last month ${stats.previousAverage}` : "No earlier month to compare"} · rest and write-off days left out
              </p>
            </section>
            <section aria-labelledby="marks-title" className="card space-y-3 lg:col-span-2">
              <h2 id="marks-title" className="text-base font-semibold">
                Days by mark
              </h2>
              <CountBlocks
                label={stats.summary}
                items={[
                  { label: "Strong", count: stats.marks.Strong, fill: "#CDE37A", deep: "#7E9A1E" },
                  { label: "Solid", count: stats.marks.Solid, fill: "#A9A3DB", deep: "#6E66B8" },
                  { label: "Light", count: stats.marks.Light, fill: "rgb(var(--lime-soft))", deep: "#7E9A1E" },
                  { label: "Missed", count: stats.marks.Missed, fill: "", deep: "rgb(var(--missed))", hatch: true },
                  { label: "Rest", count: stats.marks.Rest, fill: "transparent", deep: "rgb(var(--missed))" },
                ]}
              />
              <p className="text-[13px] text-ink-2">{stats.summary}</p>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-labelledby="cal-title" className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="cal-title" className="text-base font-semibold">
                  The month
                </h2>
                <DayLegend />
              </div>
              <MonthCalendar month={month} days={stats.days} />
              <p className="text-[13px] text-ink-2">
                Shown up on <span className="tnum font-semibold text-ink">{stats.daysShownUp}</span> days · focus{" "}
                <span className="tnum font-semibold text-ink">{stats.focusMinutes}</span> min · habits{" "}
                <span className="tnum font-semibold text-ink">{stats.habitsPct ?? "—"}</span>
                {stats.habitsPct != null ? "%" : ""}
              </p>
            </section>
            <div className="space-y-4">
              <AreaWeeks month={month} />
              <ScoreTrend />
            </div>
          </div>

          <HabitsCard />
          <ReflectionForm key={existing?.id ?? start} month={month} stats={stats} existing={existing} />
          <Kural n={666} className="max-w-read" />
        </>
      )}
    </div>
  );
}

function AreaWeeks({ month }: { month: string }) {
  const { data: weeks = [] } = useMonthWeeks(month);
  const { data: areas = [] } = useAreas();
  const ids = [...new Set(weeks.flatMap((w) => w.areaMinutes.map((a) => a.areaId)))];
  const series: BlockSeries[] = ids.map((id) => {
    const i = areas.findIndex((a) => a.id === id);
    const c = i >= 0 ? areaColor(areas[i], i) : UNASSIGNED;
    return { key: id ?? "none", label: i >= 0 ? (areas[i]?.name ?? "Area") : "Unassigned", fill: c.fill, deep: c.deep };
  });
  const columns = weeks.map((w) => ({
    label: `W${w.week.slice(-2)}`,
    values: Object.fromEntries(w.areaMinutes.map((a) => [a.areaId ?? "none", a.minutes])),
  }));
  const total = weeks.reduce((s, w) => s + w.focusMinutes, 0);
  return (
    <section aria-labelledby="areas-title" className="card space-y-3">
      <h2 id="areas-title" className="text-base font-semibold">
        Focus by area
      </h2>
      {total === 0 ? (
        <p className="text-sm text-ink-2">No focus sessions this month yet.</p>
      ) : (
        <BlockBarChart
          columns={columns}
          series={series}
          unit={30}
          unitLabel="30 min"
          label={`Focus minutes by area per week: ${series.map((s) => s.label).join(", ")}; ${total} minutes in total.`}
        />
      )}
    </section>
  );
}

function ScoreTrend() {
  const { data } = useScoreSeries(30);
  if (!data) return null;
  return (
    <section aria-labelledby="trend-title" className="card space-y-2">
      <h2 id="trend-title" className="text-base font-semibold">
        Score · 30 days
      </h2>
      <Sparkline points={data.points} avg7={data.avg7} label={data.summary} />
      <p className="text-[13px] text-ink-2">{data.summary}</p>
    </section>
  );
}

function HabitsCard() {
  const { data } = useHabitGrid(84);
  if (!data) return null;
  return (
    <section aria-labelledby="hg-title" className="card space-y-3">
      <h2 id="hg-title" className="text-base font-semibold">
        Habits · 12 weeks
      </h2>
      <HabitHeatGrid grid={data} />
    </section>
  );
}

function ReflectionForm(props: { month: string; stats: MonthStats; existing: Review | null }) {
  const toast = useToast();
  const ex = props.existing;
  const { data: areas = [] } = useAreas();
  const nextMonth = shiftMonth(props.month, 1);
  const [wins, setWins] = useState(ex?.wins ?? "");
  const [failed, setFailed] = useState(ex?.failed ?? "");
  const [why, setWhy] = useState(ex?.why ?? "");
  const [theme, setTheme] = useState(ex?.theme ?? themeFor(`${nextMonth}-01`) ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = (v: string) => v.trim() || null;
    await saveReview(
      {
        type: "month",
        periodStart: props.stats.start,
        periodEnd: props.stats.end,
        wins: n(wins),
        failed: n(failed),
        why: n(why),
        muri: ex?.muri ?? null,
        mura: ex?.mura ?? null,
        muda: ex?.muda ?? null,
        diagnosis: ex?.diagnosis ?? null,
        bottleneck: ex?.bottleneck ?? null,
        capacity: ex?.capacity ?? null,
        burnout: ex?.burnout ?? null,
        capability: ex?.capability ?? null,
        theme: n(theme),
      },
      ex,
    );
    toast("Monthly review saved.");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4" aria-label="Reflection">
        <ReviewField id="m-wins" label="Wins" value={wins} onChange={setWins} />
        <ReviewField id="m-failed" label="Not this time" value={failed} onChange={setFailed} />
        <ReviewField id="m-why" label="Why" value={why} onChange={setWhy} />
      </section>
      <section className="card space-y-4" aria-label="Alignment and theme">
        <div>
          <h2 className="text-lg font-semibold">Area alignment</h2>
          <p className="text-sm text-ink-2">How well did this month serve each area's why? 0–10.</p>
        </div>
        {areas.length === 0 ? (
          <p className="text-sm text-ink-2">Add areas in Settings to score alignment.</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((a, i) => (
              <AlignmentRow key={a.id} area={a} index={i} />
            ))}
          </ul>
        )}
        <div>
          <label htmlFor="m-theme" className="label">
            Next month's theme
          </label>
          <input id="m-theme" className="input" maxLength={200} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Kubernetes" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            {ex ? "Save review" : "Complete review"}
          </button>
        </div>
      </section>
    </form>
  );
}

function AlignmentRow({ area, index }: { area: Area; index: number }) {
  const c = areaColor(area, index);
  return (
    <li className="flex flex-wrap items-center gap-3">
      <span className="h-3 w-3 rounded-full" style={{ background: c.fill, boxShadow: `inset 0 0 0 1.5px ${c.deep}` }} aria-hidden="true" />
      <span className="min-w-[6rem] flex-1 font-medium">{area.name}</span>
      <label htmlFor={`align-${area.id}`} className="sr-only">
        {area.name} alignment
      </label>
      <select
        id={`align-${area.id}`}
        className="input w-24"
        value={area.alignmentScore ?? ""}
        onChange={(e) => void saveArea({ ...area, alignmentScore: e.target.value === "" ? null : Number(e.target.value) })}
      >
        <option value="">—</option>
        {Array.from({ length: 11 }, (_, n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </li>
  );
}
