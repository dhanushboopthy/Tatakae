import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { balanceKg, formatIsoWeek, isoWeek, type ISODate, type MaintenanceRun, type MetricBox } from "@tatakae/core";
import { DailyKcalBars, KcalLegend } from "../../components/DailyKcalBars";
import { OpenIcon } from "../../components/icons";
import { MetricCard } from "../../components/MetricCard";
import { useToast } from "../../components/Toast";
import { WeightTrendChart } from "../../components/WeightTrendChart";
import { formatDay } from "../../lib/format";
import { setMaintenance, useFitnessWeek, type FitnessWeek } from "../../lib/hooks";
import { hm, n0, n1, parseNum, pctOf } from "./shared";

// Week tab (design canvas "Fitness · Week"): calories by day, this week's maintenance (typed by hand, carried
// forward when not), four numbers, the weight trend, the weekly check-in and daily averages.

const wk = (key: string) => `W${key.slice(-2)}`;
const MIN = 800;
const MAX = 8000;

export function WeekTab({ date, today }: { date: ISODate; today: ISODate }) {
  const key = formatIsoWeek(isoWeek(date));
  const { data } = useFitnessWeek(key, today);
  if (!data) return <p className="text-ink-2">Opening…</p>;
  const s = data.summary;
  const days = s.days.map((d) => ({ date: d.date, kcal: d.kcal, target: data.dayTargets[d.date] ?? d.maintenanceKcal, maintenance: d.maintenanceKcal }));
  const label = `Daily calories ${formatDay(s.start)} to ${formatDay(s.end)}: ${days
    .map((d) => `${formatDay(d.date).slice(0, 3)} ${d.kcal == null ? "not logged" : n0(d.kcal)}`)
    .join(", ")}. Maintenance ${n0(s.maintenanceKcal)}.`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="by-day-title" className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="by-day-title" className="text-xl font-semibold">
              Calories by day
            </h2>
            <KcalLegend />
          </div>
          <DailyKcalBars days={days} label={label} />
        </section>
        <MaintenanceCard key={`${key}-${s.maintenanceKcal}-${s.maintenanceSetForWeek}`} weekKey={key} data={data} />
      </div>
      <Metrics data={data} today={today} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="week-weight-title" className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="week-weight-title" className="text-xl font-semibold">
              Weight
            </h2>
            {s.trendStartKg != null && s.trendEndKg != null && (
              <span className="text-sm text-ink-2">
                Trend{" "}
                <b className="tnum text-ink">
                  {n1(s.trendStartKg)} → {n1(s.trendEndKg)} kg
                </b>
              </span>
            )}
          </div>
          <WeightTrendChart points={data.trend} label="Weigh-ins and trend weight for the week" />
          <p className="text-sm text-ink-2">Dots are the scale. The line is the trend that the targets use, so one salty dinner doesn't move them.</p>
        </section>
        <div className="flex flex-col gap-4">
          <section aria-labelledby="check-title" className="card flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="check-title" className="text-xl font-semibold">
                Weekly check-in
              </h2>
              <Link to={`/review/week?w=${key}`} className="icon-btn-sm" aria-label="Open in Weekly Review">
                <OpenIcon size={18} />
              </Link>
            </div>
            <p className="text-[15px] leading-relaxed">{data.checkIn}</p>
            <p className="text-sm text-ink-2">Also in Weekly Review, where you set next week's maintenance.</p>
          </section>
          <Averages data={data} />
        </div>
      </div>
    </div>
  );
}

function MaintenanceCard({ weekKey, data }: { weekKey: string; data: FitnessWeek }) {
  const toast = useToast();
  const s = data.summary;
  const [text, setText] = useState(String(s.maintenanceKcal));
  const [problem, setProblem] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const n = parseNum(text);
    if (n == null || n < MIN || n > MAX) return setProblem(`Enter a number between ${n0(MIN)} and ${n0(MAX)}.`);
    setProblem(null);
    await setMaintenance(weekKey, n);
    toast(`Maintenance for ${wk(weekKey)} is ${n0(n)} kcal.`);
  }

  const note = s.maintenanceSetForWeek
    ? data.setOn
      ? `You set this on ${formatDay(data.setOn)}. The next week keeps it until you change it.`
      : "Set for this week. The next week keeps it until you change it."
    : s.maintenanceFromWeek
      ? `Carried from ${wk(s.maintenanceFromWeek)}. Type a number below to set it for ${wk(weekKey)}.`
      : "Using the default. Type a number below to set it for this week.";

  return (
    <section aria-labelledby="maint-title" className="card flex flex-col gap-3">
      <h2 id="maint-title" className="text-base font-semibold">
        Maintenance · {wk(weekKey)}
      </h2>
      <p className="flex items-baseline gap-2">
        <span className="tnum text-hero-sm">{n0(s.maintenanceKcal)}</span>
        <span className="text-lg font-medium text-ink-2">kcal</span>
      </p>
      <p className="text-sm text-ink-2">{note}</p>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-1.5">
        <label htmlFor="maint-input" className="text-[13px] font-semibold text-ink-2">
          {s.maintenanceSetForWeek ? "Change for this week" : "Set for this week"}
        </label>
        <div className="flex gap-2">
          <input
            id="maint-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode="numeric"
            aria-invalid={problem != null}
            className="input tnum"
          />
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
        {problem && (
          <p role="alert" className="text-sm font-medium">
            {problem}
          </p>
        )}
      </form>
      <MaintenanceList runs={data.runs} currentWeek={data.currentWeek} />
    </section>
  );
}

export function MaintenanceList({ runs, currentWeek }: { runs: readonly MaintenanceRun[]; currentWeek: string }) {
  if (runs.length === 0) return <p className="border-t border-line pt-3 text-sm text-ink-2">No week set yet. The default is used until you set one.</p>;
  return (
    <ul className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
      {runs.map((r) => {
        const range = r.fromWeek === r.toWeek ? wk(r.fromWeek) : `${wk(r.fromWeek)} – ${wk(r.toWeek)}`;
        const current = r.toWeek === currentWeek;
        return (
          <li key={r.fromWeek} className="flex justify-between gap-2">
            <span className="text-ink-2">
              {range}
              {current ? " · this week" : ""}
            </span>
            <span className="tnum">
              <b>{n0(r.kcal)}</b>
              {current && !r.setByHand ? <span className="text-ink-2"> · carried</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Metrics({ data, today }: { data: FitnessWeek; today: ISODate }) {
  const s = data.summary;
  const goal = data.phase?.ratePctPerWeek ?? null;
  const elapsed = s.days.filter((d) => d.date <= today).length;
  const diff = s.avgKcal != null ? s.avgKcal - s.maintenanceKcal : null;
  const proteinTarget = data.targets?.proteinG ?? null;
  const kg = Math.abs(balanceKg(s.balanceKcal));
  const box = (b: Pick<MetricBox, "key" | "label" | "value" | "progress" | "context">): MetricBox => ({ unit: "", delta: null, target: null, ...b });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        box={box({
          key: "fit_avg_kcal",
          label: "Average eaten",
          value: s.avgKcal,
          progress: null,
          context:
            diff == null ? "Nothing logged this week yet." : `${n0(Math.abs(diff))} ${diff <= 0 ? "under" : "over"} maintenance · ${s.daysLogged} of ${elapsed} days logged`,
        })}
        valueText={s.avgKcal != null ? n0(s.avgKcal) : "—"}
        unitText="kcal / day"
      />
      <MetricCard
        box={box({
          key: "fit_balance",
          label: s.balanceKcal > 0 ? "Weekly surplus" : "Weekly deficit",
          value: s.daysLogged ? s.balanceKcal : null,
          progress: null,
          context: s.daysLogged === 0 ? "Nothing logged yet." : s.balanceKcal < 0 ? `About ${kg} kg of fat` : `About ${kg} kg of body weight`,
        })}
        valueText={s.daysLogged ? `${s.balanceKcal < 0 ? "−" : s.balanceKcal > 0 ? "+" : ""}${n0(Math.abs(s.balanceKcal))}` : "—"}
        unitText="kcal"
      />
      <MetricCard
        box={box({
          key: "fit_protein",
          label: "Average protein",
          value: s.avgProteinG,
          progress: proteinTarget && s.avgProteinG != null ? pctOf(s.avgProteinG, proteinTarget) : null,
          context: proteinTarget ? `target ${proteinTarget} g` : "Log your weight to get a target.",
        })}
        valueText={s.avgProteinG != null ? String(s.avgProteinG) : "—"}
        unitText={proteinTarget ? `/ ${proteinTarget} g` : "g"}
        bar="lavender"
      />
      <MetricCard
        box={box({
          key: "fit_rate",
          label: "Rate this week",
          value: s.ratePctPerWeek,
          progress: goal && s.ratePctPerWeek != null ? Math.max(0, pctOf(Math.abs(s.ratePctPerWeek), Math.abs(goal))) : null,
          context: goal ? `goal ${Math.abs(goal)} %` : "No phase goal",
        })}
        valueText={s.ratePctPerWeek != null ? `${s.ratePctPerWeek < 0 ? "−" : s.ratePctPerWeek > 0 ? "+" : ""}${Math.abs(s.ratePctPerWeek).toFixed(2)}` : "—"}
        unitText="% / week"
      />
    </div>
  );
}

function Averages({ data }: { data: FitnessWeek }) {
  const a = data.averages;
  const items: [string, string][] = [
    ["Avg steps", a.steps != null ? n0(a.steps) : "—"],
    ["Avg water", a.waterMl != null ? `${(a.waterMl / 1000).toFixed(1)} L` : "—"],
    ["Avg sleep", a.sleepMin != null ? hm(a.sleepMin) : "—"],
    ["Avg fibre", data.summary.avgFibreG != null ? `${data.summary.avgFibreG} g` : "—"],
  ];
  return (
    <section aria-label="Daily averages" className="card grid grid-cols-2 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-card-inner bg-surface-2 px-4 py-3">
          <p className="text-xs font-medium text-ink-2">{label}</p>
          <p className="tnum text-xl font-semibold">{value}</p>
        </div>
      ))}
    </section>
  );
}
