import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { monthRange, summarizeWeek, type ISODate } from "@tatakae/core";
import { DayDetail } from "../components/DayDetail";
import { DayLegend } from "../components/DayCircle";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { MonthCalendar } from "../components/MonthCalendar";
import { PageHeader } from "../components/PageHeader";
import { SceneCard } from "../components/SceneCard";
import { Scoreboard } from "../components/Scoreboard";
import { SegmentedPills } from "../components/SegmentedPills";
import { WeekPlanner } from "../components/WeekPlanner";
import { useCalendarMonth, useScoreboard, useToday } from "../lib/hooks";

// Web Calendar (docs/11 §4, refs 06/07): Month view (DayCircle + mini 3-segment bar + screen minutes per
// cell, day sheet on the right) ↔ Week planner (time rail, anchors, focus sessions, planned missions,
// current-time line, drag-to-create) ↔ Day planner (the same, one wide column). Month / Week / Day pills.

type View = "month" | "week" | "day";

const monthTitle = (yyyymm: string) =>
  new Date(`${yyyymm}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Calendar() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const raw = params.get("view");
  const view: View = raw === "week" || raw === "day" ? raw : "month";
  const month = /^\d{4}-\d{2}$/.test(params.get("m") ?? "") ? (params.get("m") as string) : today.slice(0, 7);
  const [selected, setSelected] = useState<ISODate>(today);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Calendar"
        title={view === "month" ? monthTitle(month) : view === "week" ? "Week planner" : "Day planner"}
        actions={
          <SegmentedPills<View>
            label="Calendar view"
            value={view}
            onChange={(v) => set({ view: v === "month" ? null : v })}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
          />
        }
      />
      {view === "month" ? (
        <MonthView
          month={month}
          today={today}
          selected={selected}
          onSelect={setSelected}
          onMonth={(m) => set({ m: m === today.slice(0, 7) ? null : m })}
        />
      ) : (
        <WeekPlanner key={view} mode={view} initialDate={selected} />
      )}
      <SceneCard scene="calendar" className="max-w-read" />
    </div>
  );
}

function MonthView(props: { month: string; today: ISODate; selected: ISODate; onSelect: (d: ISODate) => void; onMonth: (m: string) => void }) {
  const { data: days } = useCalendarMonth(props.month);
  const { data: boxes } = useScoreboard();
  const isThisMonth = props.month === props.today.slice(0, 7);
  const { start, end } = monthRange(props.month);
  const past = days?.filter((d) => d.date < props.today) ?? [];
  const selectedInMonth = props.selected >= start && props.selected <= end ? props.selected : null;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label={`${monthTitle(props.month)} calendar`} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" className="icon-btn-sm" aria-label="Previous month" onClick={() => props.onMonth(shiftMonth(props.month, -1))}>
                <ChevronLeftIcon />
              </button>
              <button type="button" className="icon-btn-sm" aria-label="Next month" onClick={() => props.onMonth(shiftMonth(props.month, 1))}>
                <ChevronRightIcon />
              </button>
              {!isThisMonth && (
                <button
                  type="button"
                  className="chip bg-charcoal text-on-charcoal"
                  onClick={() => {
                    props.onMonth(props.today.slice(0, 7));
                    props.onSelect(props.today);
                  }}
                >
                  This month
                </button>
              )}
            </div>
            <DayLegend />
          </div>
          {days && <MonthCalendar month={props.month} days={days} selected={selectedInMonth} onSelect={props.onSelect} large />}
          <p className="text-[13px] text-ink-2">{past.length ? summarizeWeek(past).replace(/^(\d+) of (\d+) days/, "$1 of $2 days so far") : "Nothing closed in this month yet."}</p>
        </section>
        <div className="xl:sticky xl:top-8 xl:self-start">
          <DayDetail date={selectedInMonth ?? (isThisMonth ? props.today : start)} today={props.today} />
        </div>
      </div>
      {boxes && <Scoreboard boxes={boxes} keys={["days_shown_up", "avg_7d", "p1_hit_rate", "screen_avg"]} />}
    </>
  );
}

