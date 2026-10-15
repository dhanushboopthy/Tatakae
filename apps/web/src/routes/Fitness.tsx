import { useSearchParams } from "react-router-dom";
import { addDays, formatIsoWeek, isIsoDate, isoWeek, isoWeekRange, monthOf, monthRange, type ISODate } from "@tatakae/core";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SegmentedPills } from "../components/SegmentedPills";
import { formatDay } from "../lib/format";
import { useFitnessDay, useToday } from "../lib/hooks";
import { DayTab } from "./fitness/Day";
import { MonthTab } from "./fitness/Month";
import { PhaseTab } from "./fitness/Phase";
import { WeekTab } from "./fitness/Week";

// Fitness (docs/plans/fitness.md, design canvas "Fitness"): Day · Week · Month · Training · Phase.
// The tab and date live in the URL (?tab=week&d=2026-10-13) so each view can be linked and survives a reload.
// For Week and Month, `d` is any date inside the week or month shown.

const TABS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "training", label: "Training" },
  { value: "phase", label: "Phase" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

/** Month label like "September 2026". */
const monthName = (date: ISODate) => new Date(`${monthOf(date)}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function Fitness() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "day";
  const dParam = params.get("d");
  const date: ISODate = dParam && isIsoDate(dParam) && dParam <= today ? dParam : today;
  const { data: day } = useFitnessDay(today);

  function go(next: { tab?: Tab; d?: ISODate }) {
    const p = new URLSearchParams(params);
    const t = next.tab ?? tab;
    const d = next.d ?? date;
    if (t === "day") p.delete("tab");
    else p.set("tab", t);
    if (d === today) p.delete("d");
    else p.set("d", d > today ? today : d);
    setParams(p, { replace: true });
  }

  // Period navigation per tab: a day, an ISO week (Mon–Sun) or a calendar month. Never into the future.
  const week = isoWeek(date);
  const weekRange = isoWeekRange(week.year, week.week);
  const month = monthRange(monthOf(date));
  const nav =
    tab === "day"
      ? { label: date === today ? "Today" : formatDay(date), prev: addDays(date, -1), next: addDays(date, 1), canNext: date < today, unit: "day" }
      : tab === "week"
        ? {
            label: `W${String(week.week).padStart(2, "0")} · ${formatDay(weekRange.start).replace(/^\w+ /, "")} – ${formatDay(weekRange.end).replace(/^\w+ /, "")}`,
            prev: addDays(weekRange.start, -7),
            next: addDays(weekRange.start, 7),
            canNext: weekRange.end < today,
            unit: "week",
          }
        : tab === "month"
          ? { label: monthName(date), prev: addDays(month.start, -1), next: addDays(month.end, 1), canNext: month.end < today, unit: "month" }
          : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatDay(today, { long: true })}
        title="Fitness"
        actions={
          day?.phaseText ? (
            <span className="pill min-h-tap bg-lime-soft px-4 text-sm text-ink">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lime-deep" />
              {day.phaseText}
            </span>
          ) : (
            <button type="button" className="pill min-h-tap bg-surface px-4 text-sm text-ink-2" onClick={() => go({ tab: "phase" })}>
              No phase started
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedPills label="Fitness views" options={TABS} value={tab} onChange={(t) => go({ tab: t })} />
        {nav && (
          <div className="flex items-center gap-2">
            <button type="button" className="icon-btn-sm bg-surface" aria-label={`Previous ${nav.unit}`} onClick={() => go({ d: nav.prev })}>
              <ChevronLeftIcon />
            </button>
            <span className="min-w-[4.5rem] px-2 text-center text-sm font-semibold">{nav.label}</span>
            <button type="button" className="icon-btn-sm bg-surface disabled:opacity-50" aria-label={`Next ${nav.unit}`} disabled={!nav.canNext} onClick={() => go({ d: nav.next })}>
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>

      {tab === "day" && <DayTab date={date} today={today} onTab={(t) => go({ tab: t })} />}
      {tab === "week" && <WeekTab key={formatIsoWeek(week)} date={date} today={today} />}
      {tab === "month" && <MonthTab date={date} today={today} />}
      {tab === "phase" && <PhaseTab today={today} onTab={(t) => go({ tab: t })} />}
      {tab === "training" && <EmptyState title="Training is coming next" body="This view arrives in a later step." />}
    </div>
  );
}
