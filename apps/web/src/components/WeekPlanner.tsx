import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  addDays,
  appDayOf,
  focusMinutes,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  type Area,
  type FocusSession,
  type ISODate,
  type Mission,
} from "@tatakae/core";
import { areaColor } from "../lib/colors";
import { formatDay, weekdayInitial } from "../lib/format";
import {
  editLocked,
  needsLockReason,
  upsertMission,
  useAnchors,
  useAreas,
  useBacklog,
  useDaysRange,
  useFocusSessions,
  useGoals,
  useMissionsRange,
  useNow,
  useToday,
} from "../lib/hooks";
import { RAIL, anchorsFor, firstFreeSlot, hhmmOf, istMinutesOf, railSpan, railTimeAt, toMinutes } from "../lib/plan";
import { AreaBlock } from "./AreaBlock";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { LockReasonDialog } from "./LockReasonDialog";
import { Modal } from "./Modal";
import { HourLines, NowLine, TimeRail } from "./TimeRail";
import { useToast } from "./Toast";

/**
 * Week planner (docs/11 §4, refs 06/07): Mon–Sun columns on a 06:00–24:00 rail. Anchors are grey
 * blocks, focus sessions (actual) are area-coloured blocks, missions with a planned start are outlined
 * blocks, and today has a charcoal current-time line. Drag a backlog item (or a planned mission) onto a
 * day to plan it at that time; every drag has a keyboard path through the "Plan" dialog. Changing a
 * locked day asks for a reason (mura event).
 */

const HOUR_PX = 48;
const RAIL_PX = ((RAIL.endMin - RAIL.startMin) / 60) * HOUR_PX;
const DRAG_TYPE = "application/x-tatakae-mission";

interface Placement {
  mission: Mission;
  date: ISODate;
  plannedStart: string;
}

export function WeekPlanner(props: { initialWeek: { year: number; week: number } }) {
  const today = useToday();
  const toast = useToast();
  const now = useNow(60_000);
  const [week, setWeek] = useState(props.initialWeek);
  const { start, end } = isoWeekRange(week.year, week.week);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const { data: anchors = [] } = useAnchors();
  const { data: focus = [] } = useFocusSessions(start, end);
  const { data: missions = [] } = useMissionsRange(start, end);
  const { data: backlog = [] } = useBacklog();
  const { data: days = {} } = useDaysRange(start, end);
  const { data: areas = [] } = useAreas();
  const { data: goals = [] } = useGoals();

  const [pending, setPending] = useState<{ placement: Placement; next: Mission } | null>(null);
  const [planning, setPlanning] = useState<Mission | null>(null);

  const thisWeek = isoWeek(today);
  const isThisWeek = thisWeek.year === week.year && thisWeek.week === week.week;
  const shift = (n: number) => setWeek(isoWeek(addDays(start, n * 7)));

  const areaOf = (missionId: string | null, areaId: string | null): Area | null => {
    if (areaId) return areas.find((a) => a.id === areaId) ?? null;
    const m = missions.find((x) => x.id === missionId);
    const g = m?.goalId ? goals.find((x) => x.id === m.goalId) : undefined;
    return g?.areaId ? (areas.find((a) => a.id === g.areaId) ?? null) : null;
  };

  /** Place a mission on a date at a time; checks slots and the plan lock. */
  async function place(p: Placement) {
    const sameDay = p.mission.dayDate === p.date && p.mission.slot !== "backlog";
    let next: Mission;
    if (sameDay) next = { ...p.mission, plannedStart: p.plannedStart };
    else {
      const onDay = missions.filter((m) => m.dayDate === p.date && m.deletedAt == null && m.id !== p.mission.id);
      const keep = p.mission.slot !== "backlog" && firstFreeSlot(onDay, [p.mission.slot]) === p.mission.slot ? p.mission.slot : null;
      const slot = keep ?? firstFreeSlot(onDay, ["P2", "P3", "side"]);
      if (!slot || slot === "backlog") {
        toast("That day already has its three missions and a side quest.");
        return;
      }
      next = { ...p.mission, dayDate: p.date, slot, status: "open", plannedStart: p.plannedStart };
    }
    const forged = days[p.date]?.forgedAt != null || (p.mission.dayDate != null && days[p.mission.dayDate]?.forgedAt != null);
    if (needsLockReason(p.mission.slot === "backlog" ? null : p.mission, next, forged)) {
      setPending({ placement: p, next });
      return;
    }
    await upsertMission(next);
    toast(`Planned for ${formatDay(p.date)} at ${p.plannedStart}.`);
  }

  function onDrop(e: DragEvent<HTMLDivElement>, date: ISODate) {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE);
    const m = [...backlog, ...missions].find((x) => x.id === id);
    if (!m) return;
    const rect = e.currentTarget.getBoundingClientRect();
    void place({ mission: m, date, plannedStart: railTimeAt((e.clientY - rect.top) / rect.height) });
  }

  const nowMin = istMinutesOf(now.toISOString());
  const nowSpan = railSpan(nowMin, 1);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label={`Week ${formatIsoWeek(week)}`} className="card min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="icon-btn-sm" aria-label="Previous week" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="icon-btn-sm" aria-label="Next week" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </button>
          <h2 className="ml-1 text-lg font-semibold">
            {formatDay(start).replace(/^\w+ /, "")} – {formatDay(end).replace(/^\w+ /, "")}
          </h2>
          {!isThisWeek && (
            <button type="button" className="chip bg-charcoal text-on-charcoal" onClick={() => setWeek(thisWeek)}>
              This week
            </button>
          )}
          <PlannerLegend />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Column headers */}
            <div className="flex">
              <span className="w-12 shrink-0" />
              <div className="grid flex-1 grid-cols-7 gap-1.5">
                {dates.map((d) => (
                  <div key={d} className="pb-2 text-center text-[13px] font-semibold">
                    {weekdayInitial(d)}
                    <span
                      className={`tnum ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                        d === today ? "bg-charcoal text-on-charcoal" : "text-ink-2"
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {days[d]?.forgedAt && <span className="sr-only"> (locked)</span>}
                  </div>
                ))}
              </div>
            </div>
            {/* Unscheduled missions per day */}
            <div className="flex">
              <span className="w-12 shrink-0" />
              <div className="grid flex-1 grid-cols-7 gap-1.5 pb-2">
                {dates.map((d) => {
                  const loose = missions.filter((m) => m.dayDate === d && !m.plannedStart && m.status !== "rescheduled");
                  return (
                    <ul key={d} className="min-h-[28px] space-y-1" aria-label={`${formatDay(d)}: missions without a time`}>
                      {loose.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, m.id)}
                            onClick={() => setPlanning(m)}
                            className="w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-left text-[11px] font-semibold hover:bg-line"
                            title={`${m.slot}: ${m.title} — set a time`}
                          >
                            {m.slot === "side" ? "Side" : m.slot} · {m.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })}
              </div>
            </div>
            {/* Rail + columns */}
            <div className="flex max-h-[640px] overflow-y-auto" tabIndex={0} aria-label="Week grid, 06:00 to 24:00">
              <TimeRail hourPx={HOUR_PX} />
              <div className="grid flex-1 grid-cols-7 gap-1.5">
                {dates.map((d) => (
                  <div
                    key={d}
                    className={`relative rounded-[14px] ${d === today ? "bg-lime-soft/40" : "bg-surface-2/50"}`}
                    style={{ height: RAIL_PX }}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
                    }}
                    onDrop={(e) => onDrop(e, d)}
                  >
                    <HourLines hourPx={HOUR_PX} />
                    {anchorsFor(anchors, d).map((a) => {
                      const s = toMinutes(a.startTime);
                      const e = toMinutes(a.endTime);
                      const span = railSpan(s, (e > s ? e : 1440) - s);
                      if (!span) return null;
                      return (
                        <div
                          key={a.id}
                          className="absolute inset-x-1 overflow-hidden rounded-[12px] bg-line/80 p-2 text-[11px] font-semibold text-ink-2"
                          style={{ top: span.top * RAIL_PX, height: span.height * RAIL_PX }}
                          title={`${a.name} ${a.startTime}–${a.endTime}`}
                        >
                          {a.name}
                          <span className="tnum block font-medium">
                            {a.startTime}–{a.endTime}
                          </span>
                        </div>
                      );
                    })}
                    {missions
                      .filter((m) => m.dayDate === d && m.plannedStart && m.status !== "rescheduled")
                      .map((m) => {
                        const span = railSpan(toMinutes(m.plannedStart ?? "09:00"), m.estMin ?? 30);
                        if (!span) return null;
                        const area = areaOf(m.id, null);
                        const c = areaColor(area, 0);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, m.id)}
                            onClick={() => setPlanning(m)}
                            className="absolute inset-x-1 z-10 text-left"
                            style={{ top: span.top * RAIL_PX, height: Math.max(28, span.height * RAIL_PX) }}
                            aria-label={`${m.slot} ${m.title}, planned ${m.plannedStart}. Change time`}
                          >
                            <AreaBlock
                              planned
                              compact
                              tag={area?.name ?? m.slot}
                              title={m.title}
                              time={`${m.plannedStart}${m.estMin ? ` · ${m.estMin} min` : ""}`}
                              fill={area ? c.fill : "#E9E7F8"}
                              deep={area ? c.deep : "#6E66B8"}
                            />
                          </button>
                        );
                      })}
                    {focus.map((f) => (
                      <FocusBlock key={f.id} session={f} date={d} areaOf={areaOf} missions={missions} now={now} />
                    ))}
                    {d === today && nowSpan && <NowLine top={nowSpan.top * RAIL_PX} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BacklogPanel backlog={backlog} onPlan={setPlanning} />

      <PlanDialog
        mission={planning}
        dates={dates}
        onClose={() => setPlanning(null)}
        onPlace={async (p) => {
          setPlanning(null);
          await place(p);
        }}
      />
      <LockReasonDialog
        open={pending !== null}
        summary={pending ? `Plan "${pending.placement.mission.title}" on ${formatDay(pending.placement.date)} (locked day)` : undefined}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending) return;
          await editLocked(pending.placement.mission, pending.next, reason);
          setPending(null);
          toast("Planned. The reason is saved for Sunday.");
        }}
      />
    </div>
  );
}

function FocusBlock(props: {
  session: FocusSession;
  date: ISODate;
  areaOf: (missionId: string | null, areaId: string | null) => Area | null;
  missions: readonly Mission[];
  now: Date;
}) {
  const f = props.session;
  // Only in the column of its app day (IST, 04:00 boundary); after-midnight blocks clip at the rail end.
  if (appDayOf(f.startedAt) !== props.date) return null;
  const startMin = istMinutesOf(f.startedAt);
  const minutes = f.endedAt ? focusMinutes(f) : Math.max(1, Math.round((props.now.getTime() - Date.parse(f.startedAt)) / 60_000));
  const span = railSpan(startMin, minutes);
  if (!span) return null;
  const area = props.areaOf(f.missionId, f.areaId);
  const c = areaColor(area, 0);
  const m = props.missions.find((x) => x.id === f.missionId);
  return (
    <div className="absolute left-3 right-1 z-[15]" style={{ top: span.top * RAIL_PX, height: Math.max(22, span.height * RAIL_PX) }}>
      <AreaBlock
        compact
        tag={area?.name ?? "Focus"}
        title={m?.title ?? "Open focus"}
        time={`${hhmmOf(startMin)} · ${minutes} min${f.endedAt ? "" : " · running"}`}
        fill={area ? c.fill : "#CDE37A"}
        deep={area ? c.deep : "#7E9A1E"}
      />
    </div>
  );
}

function PlannerLegend() {
  return (
    <p className="ml-auto flex flex-wrap gap-3 text-[12px] text-ink-2" aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-line" /> Anchor
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border-2 border-dashed border-lavender-deep" /> Planned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-lime" /> Focus done
      </span>
    </p>
  );
}

function BacklogPanel(props: { backlog: readonly Mission[]; onPlan: (m: Mission) => void }) {
  return (
    <aside aria-labelledby="backlog-title" className="card space-y-3 xl:sticky xl:top-8 xl:self-start">
      <div className="flex items-center justify-between">
        <h2 id="backlog-title" className="text-base font-semibold">
          Backlog
        </h2>
        <span className="tnum text-sm text-ink-2">{props.backlog.length}</span>
      </div>
      <p className="text-[13px] text-ink-2">Drag onto a day, or press Plan.</p>
      {props.backlog.length === 0 ? (
        <p className="text-sm text-ink-2">Empty. Rescheduled missions and inbox items you keep land here.</p>
      ) : (
        <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {props.backlog.map((m) => (
            <li
              key={m.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, m.id)}
              className="flex cursor-grab items-center gap-2 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2 active:cursor-grabbing"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.title}</span>
                {m.rescheduleCount > 0 && <span className="text-xs text-ink-2">Moved {m.rescheduleCount}×</span>}
              </span>
              <button type="button" className="btn min-h-tap bg-surface px-3 text-sm" onClick={() => props.onPlan(m)}>
                Plan
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function PlanDialog(props: {
  mission: Mission | null;
  dates: readonly ISODate[];
  onClose: () => void;
  onPlace: (p: Placement) => void | Promise<void>;
}) {
  const m = props.mission;
  return (
    <Modal open={m !== null} onClose={props.onClose} title="Plan a time" description={m?.title}>
      {m && <PlanForm mission={m} dates={props.dates} onPlace={props.onPlace} onCancel={props.onClose} />}
    </Modal>
  );
}

function PlanForm(props: { mission: Mission; dates: readonly ISODate[]; onPlace: (p: Placement) => void | Promise<void>; onCancel: () => void }) {
  const m = props.mission;
  const today = useToday();
  const initialDate = m.dayDate && props.dates.includes(m.dayDate) ? m.dayDate : (props.dates.find((d) => d >= today) ?? props.dates[0] ?? today);
  const [date, setDate] = useState<ISODate>(initialDate);
  const [time, setTime] = useState(m.plannedStart ?? "09:00");
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    void props.onPlace({ mission: m, date, plannedStart: time });
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="plan-date" className="label">
            Day
          </label>
          <select id="plan-date" className="input" autoFocus value={date} onChange={(e) => setDate(e.target.value)}>
            {props.dates.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="plan-time" className="label">
            Start
          </label>
          <input id="plan-time" type="time" step={900} className="input tnum" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Plan
        </button>
      </div>
    </form>
  );
}

