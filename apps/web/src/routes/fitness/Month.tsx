import { monthGrid, monthOf, type ISODate, type MetricBox } from "@tatakae/core";
import { MetricCard } from "../../components/MetricCard";
import { WeightTrendChart } from "../../components/WeightTrendChart";
import { formatDay } from "../../lib/format";
import { useFitnessMonth, type FitnessMonth, type FitnessMonthDay } from "../../lib/hooks";
import { n0, n1, pctOf } from "./shared";

// Month tab (design canvas "Fitness · Month"): trend weight, average rate, calories, days logged, the weight
// chart, a calendar of days against target and a row per week.

const MONTH_NAME = (yyyymm: string) =>
  new Date(`${yyyymm}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

const signed = (n: number, digits = 2) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${Math.abs(n).toFixed(digits)}`;

export function MonthTab({ date, today }: { date: ISODate; today: ISODate }) {
  const month = monthOf(date);
  const { data } = useFitnessMonth(month, today);
  if (!data) return <p className="text-ink-2">Opening…</p>;
  return (
    <div className="space-y-4">
      <Metrics data={data} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="month-weight-title" className="card flex flex-col gap-3">
          <h2 id="month-weight-title" className="text-xl font-semibold">
            Weight · {MONTH_NAME(month).split(" ")[0]}
          </h2>
          <WeightTrendChart points={data.trend} label={`Weigh-ins and trend weight in ${MONTH_NAME(month)}`} height={220} />
          <p className="flex flex-wrap gap-4 text-[13px] text-ink-2" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-2" />
              Weigh-in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full" style={{ background: "#7E9A1E" }} />
              Trend
            </span>
          </p>
        </section>
        <CalendarCard month={month} data={data} today={today} />
      </div>
      <WeeksTable data={data} />
    </div>
  );
}

function Metrics({ data }: { data: FitnessMonth }) {
  const s = data.summary;
  const goal = data.phase?.ratePctPerWeek ?? null;
  const change = s.weightChangeKg;
  const pct = s.trendStartKg ? (((change ?? 0) / s.trendStartKg) * 100).toFixed(1) : null;
  const box = (b: Pick<MetricBox, "key" | "label" | "value" | "progress" | "context">): MetricBox => ({ unit: "", delta: null, target: null, ...b });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        box={box({
          key: "fit_trend",
          label: "Trend weight",
          value: change,
          progress: null,
          context: s.trendStartKg != null && s.trendEndKg != null ? `${n1(s.trendStartKg)} → ${n1(s.trendEndKg)} kg` : "Weigh in a few times to see a trend.",
        })}
        valueText={change != null ? signed(change, 1) : "—"}
        unitText={change != null && pct != null ? `kg · ${signed(Number(pct), 1)} %` : "kg"}
      />
      <MetricCard
        box={box({
          key: "fit_rate",
          label: "Average rate",
          value: s.ratePctPerWeek,
          progress: goal && s.ratePctPerWeek != null ? Math.max(0, pctOf(Math.abs(s.ratePctPerWeek), Math.abs(goal))) : null,
          context: goal ? `goal ${Math.abs(goal)} %` : "No phase goal",
        })}
        valueText={s.ratePctPerWeek != null ? signed(s.ratePctPerWeek) : "—"}
        unitText="% / week"
      />
      <MetricCard
        box={box({
          key: "fit_avg_kcal",
          label: "Average eaten",
          value: s.avgKcal,
          progress: null,
          context: s.avgProteinG != null ? `Protein avg ${s.avgProteinG} g` : "Nothing logged this month.",
        })}
        valueText={s.avgKcal != null ? n0(s.avgKcal) : "—"}
        unitText="kcal / day"
      />
      <MetricCard
        box={box({
          key: "fit_days",
          label: "Days logged",
          value: s.daysLogged,
          progress: null,
          context: `${s.weighIns} / ${data.daysElapsed} weigh-ins`,
        })}
        valueText={String(s.daysLogged)}
        unitText={`/ ${data.daysElapsed} food`}
      />
    </div>
  );
}

function Cell({ day }: { day: FitnessMonthDay & { future: boolean } }) {
  const n = Number(day.date.slice(8, 10));
  const over = day.kcal != null && day.kcal > day.target;
  const under = day.kcal != null && !over;
  const label = `${formatDay(day.date)}: ${
    day.future ? "not yet" : day.kcal == null ? "not logged" : `${n0(day.kcal)} kcal, ${over ? "above" : "at or under"} the ${n0(day.target)} target`
  }`;
  const cls = under
    ? "bg-lime text-on-accent font-semibold"
    : over
      ? "bg-area-butter text-on-accent font-semibold shadow-[inset_0_0_0_1.5px_#A88A1C]"
      : day.future
        ? "text-ink-2"
        : "border-2 border-dashed border-missed text-ink";
  return (
    <span role="img" aria-label={label} className={`tnum relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[14px] ${cls}`}>
      {n}
      {over && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 text-[9px] leading-none">
          ▲
        </span>
      )}
    </span>
  );
}

function CalendarCard({ month, data, today }: { month: string; data: FitnessMonth; today: ISODate }) {
  const grid = monthGrid(month, data.days.map((d) => ({ ...d, future: d.date > today })));
  return (
    <section aria-labelledby="cal-vs-title" className="card flex flex-col gap-3">
      <h2 id="cal-vs-title" className="text-xl font-semibold">
        Calories vs target
      </h2>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <span key={w} className="pb-1 text-xs font-medium text-ink-2">
            {w}
          </span>
        ))}
        {grid.flat().map((d, i) => (d ? <Cell key={d.date} day={d} /> : <span key={`pad-${i}`} />))}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-lime" />
          At or under target ({data.atOrUnder} {data.atOrUnder === 1 ? "day" : "days"})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-area-butter" style={{ boxShadow: "inset 0 0 0 1.5px #A88A1C" }} />
          Above ▲ ({data.over})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-missed" />
          Not logged ({data.notLogged})
        </span>
      </p>
    </section>
  );
}

function WeeksTable({ data }: { data: FitnessMonth }) {
  return (
    <section aria-labelledby="weeks-title" className="card flex flex-col gap-3">
      <h2 id="weeks-title" className="text-xl font-semibold">
        Week by week
      </h2>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[13px] text-ink-2">
              {["Week", "Maintenance", "Avg eaten", "Avg protein", "Balance", "Trend", "Rate"].map((h) => (
                <th key={h} scope="col" className="pb-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.summary.weeks.map((w) => (
              <tr key={w.isoWeek} className="border-t border-line">
                <th scope="row" className="py-3 pr-3 text-left font-normal">
                  <b>W{w.isoWeek.slice(-2)}</b> <span className="ml-1.5 text-ink-2">{formatDay(w.start).slice(4)} – {formatDay(w.end).slice(4)}</span>
                </th>
                <td className="pr-3">{n0(w.maintenanceKcal)}</td>
                <td className="pr-3">{w.avgKcal != null ? n0(w.avgKcal) : "—"}</td>
                <td className="pr-3">{w.avgProteinG != null ? `${w.avgProteinG} g` : "—"}</td>
                <td className="pr-3">{w.daysLogged ? `${w.balanceKcal < 0 ? "−" : w.balanceKcal > 0 ? "+" : ""}${n0(Math.abs(w.balanceKcal))}` : "—"}</td>
                <td className="pr-3">{w.trendStartKg != null && w.trendEndKg != null ? `${n1(w.trendStartKg)} → ${n1(w.trendEndKg)}` : "—"}</td>
                <td>
                  {w.ratePctPerWeek != null ? (
                    <span className="pill bg-surface-2 text-ink">{signed(w.ratePctPerWeek)} %{w.days.length < 7 ? ` · ${w.days.length} days` : ""}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
