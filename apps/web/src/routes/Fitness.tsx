import { useSearchParams } from "react-router-dom";
import { addDays, isIsoDate, type ISODate } from "@tatakae/core";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SegmentedPills } from "../components/SegmentedPills";
import { formatDay } from "../lib/format";
import { useFitnessDay, useToday } from "../lib/hooks";
import { DayTab } from "./fitness/Day";

// Fitness (docs/plans/fitness.md, design canvas "Fitness"): Day · Week · Month · Training · Phase.
// The tab and date live in the URL (?tab=week&d=2026-10-13) so each view can be linked and survives a reload.

const TABS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "training", label: "Training" },
  { value: "phase", label: "Phase" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

export function Fitness() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "day";
  const dParam = params.get("d");
  const date: ISODate = dParam && isIsoDate(dParam) && dParam <= today ? dParam : today;
  const { data: day } = useFitnessDay(date);

  function go(next: { tab?: Tab; d?: ISODate }) {
    const p = new URLSearchParams(params);
    const t = next.tab ?? tab;
    const d = next.d ?? date;
    if (t === "day") p.delete("tab");
    else p.set("tab", t);
    if (d === today) p.delete("d");
    else p.set("d", d);
    setParams(p, { replace: true });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatDay(date, { long: true })}
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
        {tab === "day" && (
          <div className="flex items-center gap-2">
            <button type="button" className="icon-btn-sm bg-surface" aria-label="Previous day" onClick={() => go({ d: addDays(date, -1) })}>
              <ChevronLeftIcon />
            </button>
            <span className="min-w-[4.5rem] px-2 text-center text-sm font-semibold">{date === today ? "Today" : formatDay(date)}</span>
            <button
              type="button"
              className="icon-btn-sm bg-surface disabled:opacity-50"
              aria-label="Next day"
              disabled={date >= today}
              onClick={() => go({ d: addDays(date, 1) })}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>

      {tab === "day" ? (
        <DayTab date={date} today={today} onTab={(t) => go({ tab: t })} />
      ) : (
        <EmptyState title={`${TABS.find((t) => t.value === tab)?.label} is coming next`} body="This view arrives in a later step. The Day view is ready." />
      )}
    </div>
  );
}
