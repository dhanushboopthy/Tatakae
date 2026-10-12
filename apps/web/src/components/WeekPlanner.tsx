import { useMemo, useRef, useState, type DragEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  RANKED_SLOTS,
  addDays,
  appDayOf,
  firstFreeRanked,
  focusMinutes,
  isoWeek,
  isoWeekRange,
  type Area,
  type FocusSession,
  type ISODate,
  type Mission,
  type Slot,
} from "@tatakae/core";
import { areaColor } from "../lib/colors";
import { formatDay, weekdayInitial } from "../lib/format";
import {
  blankMission,
  editLocked,
  needsLockReason,
  patchMissionFree,
  upsertMission,
  useAnchors,
  useAreas,
  useBacklog,
  useDaysRange,
  useFocusSessions,
  useGoals,
  useMissionsRange,
  useNow,
  useSettings,
  useToday,
} from "../lib/hooks";
import {
  AFTER_P1,
  RAIL,
  anchorsFor,
  dragRange,
  durationLabel,
  firstFreeSlot,
  hhmmOf,
  istMinutesOf,
  railMinutesAt,
  railSpan,
  rangeLabel,
  resizeTo,
  toMinutes,
} from "../lib/plan";
import { AreaBlock } from "./AreaBlock";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "./icons";
import { LockReasonDialog } from "./LockReasonDialog";
import { Modal } from "./Modal";
import { HourLines, NowLine, TimeRail } from "./TimeRail";
import { useToast } from "./Toast";

/**
 * Week / day planner (docs/11 §4, refs 06/07): day columns on a 06:00–24:00 rail. Anchors are grey
 * blocks, focus sessions (actual) are area-coloured blocks, missions with a planned start are outlined
 * blocks, and today has a charcoal current-time line.
 *   - Drag on empty time (today or later) to create a mission there; a click makes a default-length one.
 *   - Drag a block's bottom edge to change its length; drag a block (or a backlog item) to move it, with
 *     a live preview of where it lands.
 * Every pointer action has a keyboard path: "New mission" and the "Plan" dialog (day, start, length).
 * Changing or adding to a locked day asks for a reason (mura event).
 */

const HOUR_PX = 48;
const RAIL_PX = ((RAIL.endMin - RAIL.startMin) / 60) * HOUR_PX;
const DRAG_TYPE = "application/x-tatakae-mission";
/** Pointer travel (px) below which a press counts as a click. */
const CLICK_PX = 4;

export type PlannerMode = "week" | "day";

interface Placement {
  mission: Mission;
  date: ISODate;
  plannedStart: string;
  estMin?: number;
}

/** A block being drawn or offered for creation. */
interface Draft {
  date: ISODate;
  startMin: number;
  durationMin: number;
}

interface Selecting {
  date: ISODate;
  a: number;
  b: number;
  y0: number;
  moved: boolean;
}

interface PendingLock {
  summary: string;
  save: (reason: string) => Promise<void>;
}

const fractionIn = (el: Element, clientY: number): number => {
  const r = el.getBoundingClientRect();
  return (clientY - r.top) / r.height;
};

export function WeekPlanner(props: { mode: PlannerMode; initialDate: ISODate }) {
  const today = useToday();
  const toast = useToast();
  const now = useNow(60_000);
  const { data: settings } = useSettings();
  const focusDefault = settings?.focus_default ?? 50;
  const [anchor, setAnchor] = useState<ISODate>(props.initialDate);
  const week = props.mode === "week" ? isoWeekRange(isoWeek(anchor).year, isoWeek(anchor).week) : { start: anchor, end: anchor };
  const { start, end } = week;
  const dates = useMemo(() => (props.mode === "week" ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [anchor]), [props.mode, start, anchor]);

  const { data: anchors = [] } = useAnchors();
  const { data: focus = [] } = useFocusSessions(start, end);
  const { data: missions = [] } = useMissionsRange(start, end);
  const { data: backlog = [] } = useBacklog();
  const { data: days = {} } = useDaysRange(start, end);
  const { data: areas = [] } = useAreas();
  const { data: goals = [] } = useGoals();

  const [pending, setPending] = useState<PendingLock | null>(null);
  const [planning, setPlanning] = useState<Mission | null>(null);
  const [creating, setCreating] = useState<Draft | null>(null);
  const [selecting, setSelecting] = useState<Selecting | null>(null);
  const [hover, setHover] = useState<Draft | null>(null);
  const dragged = useRef<Mission | null>(null);

  const step = props.mode === "week" ? 7 : 1;
  const isCurrent = props.mode === "week" ? dates.includes(today) : anchor === today;
  const forgedOn = (d: ISODate | null) => d != null && days[d]?.forgedAt != null;
  const live = (d: ISODate) => missions.filter((m) => m.dayDate === d && m.deletedAt == null && m.status !== "rescheduled");

  const areaOf = (missionId: string | null, areaId: string | null): Area | null => {
    if (areaId) return areas.find((a) => a.id === areaId) ?? null;
    const m = missions.find((x) => x.id === missionId);
    const g = m?.goalId ? goals.find((x) => x.id === m.goalId) : undefined;
    return g?.areaId ? (areas.find((a) => a.id === g.areaId) ?? null) : null;
  };

  /** Save now, or ask for a reason first when the change touches a locked plan. */
  async function saveOrAsk(prev: Mission | null, next: Mission, summary: string, done: string) {
    const forged = forgedOn(next.dayDate) || forgedOn(prev?.dayDate ?? null);
    if (needsLockReason(prev && prev.slot !== "backlog" ? prev : null, next, forged)) {
      setPending({
        summary,
        save: async (reason) => {
          if (prev) await editLocked(prev, next, reason);
          else await upsertMission(next, { lockReason: reason });
          toast(`${done} The reason is saved for Sunday.`);
        },
      });
      return;
    }
    await upsertMission(next);
    toast(done);
  }

  /** Place a mission on a date at a time; checks slots and the plan lock. */
  async function place(p: Placement) {
    const sameDay = p.mission.dayDate === p.date && p.mission.slot !== "backlog";
    const estMin = p.estMin ?? p.mission.estMin;
    let next: Mission;
    if (sameDay) next = { ...p.mission, plannedStart: p.plannedStart, estMin };
    else {
      const onDay = live(p.date).filter((m) => m.id !== p.mission.id);
      const keep = p.mission.slot !== "backlog" && firstFreeSlot(onDay, [p.mission.slot]) === p.mission.slot ? p.mission.slot : null;
      const slot = keep ?? firstFreeSlot(onDay, AFTER_P1);
      if (!slot || slot === "backlog") {
        toast("That day already has nine missions and a side quest. Use the backlog.");
        return;
      }
      next = { ...p.mission, dayDate: p.date, slot, status: "open", plannedStart: p.plannedStart, estMin };
    }
    await saveOrAsk(p.mission, next, `Plan "${p.mission.title}" on ${formatDay(p.date)} (locked day)`, `Planned for ${formatDay(p.date)} at ${p.plannedStart}.`);
  }

  async function resize(m: Mission, minutes: number) {
    if (minutes === m.estMin) return;
    await patchMissionFree(m, { estMin: minutes }); // estMin is a free field: never needs a reason
    toast(`${m.title}: ${durationLabel(minutes)}.`, { durationMs: 1500 });
  }

  // ---- drag to create (pointer) ----

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, date: ISODate) {
    if (date < today || e.button !== 0 || e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fractionIn(e.currentTarget, e.clientY);
    setSelecting({ date, a: f, b: f, y0: e.clientY, moved: false });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>, date: ISODate) {
    if (!selecting || selecting.date !== date) return;
    const b = fractionIn(e.currentTarget, e.clientY);
    const moved = selecting.moved || Math.abs(e.clientY - selecting.y0) > CLICK_PX;
    if (b !== selecting.b || moved !== selecting.moved) setSelecting({ ...selecting, b, moved });
  }

  function onPointerUp(date: ISODate) {
    if (!selecting || selecting.date !== date) return;
    const r = selecting.moved ? dragRange(selecting.a, selecting.b) : dragRange(selecting.a, selecting.a, { minDur: focusDefault });
    setSelecting(null);
    setCreating({ date, ...r });
  }

  // ---- move (HTML5 drag) with a live preview ----

  function startDrag(e: DragEvent<HTMLElement>, m: Mission) {
    e.dataTransfer.setData(DRAG_TYPE, m.id);
    e.dataTransfer.effectAllowed = "move";
    dragged.current = m;
  }

  function endDrag() {
    dragged.current = null;
    setHover(null);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>, date: ISODate) {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    const startMin = railMinutesAt(fractionIn(e.currentTarget, e.clientY));
    const durationMin = dragged.current?.estMin ?? 30;
    if (hover?.date !== date || hover.startMin !== startMin) setHover({ date, startMin, durationMin });
  }

  function onDrop(e: DragEvent<HTMLDivElement>, date: ISODate) {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE);
    const m = [...backlog, ...missions].find((x) => x.id === id);
    const startMin = railMinutesAt(fractionIn(e.currentTarget, e.clientY));
    endDrag();
    if (m) void place({ mission: m, date, plannedStart: hhmmOf(startMin) });
  }

  const nowMin = istMinutesOf(now.toISOString());
  const nowSpan = railSpan(nowMin, 1);
  const cols = props.mode === "week" ? "grid-cols-7" : "grid-cols-1";
  const firstOpen = dates.find((d) => d >= today) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label={props.mode === "week" ? `Week of ${formatDay(start)}` : formatDay(anchor, { long: true })} className="card min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="icon-btn-sm" aria-label={props.mode === "week" ? "Previous week" : "Previous day"} onClick={() => setAnchor(addDays(anchor, -step))}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="icon-btn-sm" aria-label={props.mode === "week" ? "Next week" : "Next day"} onClick={() => setAnchor(addDays(anchor, step))}>
            <ChevronRightIcon />
          </button>
          <h2 className="ml-1 text-lg font-semibold">
            {props.mode === "week" ? `${formatDay(start).replace(/^\w+ /, "")} – ${formatDay(end).replace(/^\w+ /, "")}` : formatDay(anchor, { long: true })}
          </h2>
          {!isCurrent && (
            <button type="button" className="chip bg-charcoal text-on-charcoal" onClick={() => setAnchor(today)}>
              {props.mode === "week" ? "This week" : "Today"}
            </button>
          )}
          {firstOpen && (
            <button
              type="button"
              className="btn-secondary min-h-tap px-4 text-sm"
              onClick={() => setCreating({ date: firstOpen, startMin: 9 * 60, durationMin: focusDefault })}
            >
              <PlusIcon size={16} /> New mission
            </button>
          )}
          <PlannerLegend />
        </div>
        <p className="text-[13px] text-ink-2">Drag on empty time to add a mission. Drag a block's bottom edge to change its length.</p>

        <div className="overflow-x-auto">
          <div className={props.mode === "week" ? "min-w-[760px]" : ""}>
            {/* Column headers */}
            <div className="flex">
              <span className="w-12 shrink-0" />
              <div className={`grid flex-1 ${cols} gap-1.5`}>
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
            {/* Missions without a time, per day */}
            <div className="flex">
              <span className="w-12 shrink-0" />
              <div className={`grid flex-1 ${cols} gap-1.5 pb-2`}>
                {dates.map((d) => (
                  <ul key={d} className="min-h-[28px] space-y-1" aria-label={`${formatDay(d)}: missions without a time`}>
                    {live(d)
                      .filter((m) => !m.plannedStart)
                      .map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => startDrag(e, m)}
                            onDragEnd={endDrag}
                            onClick={() => setPlanning(m)}
                            className="w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-left text-[11px] font-semibold hover:bg-line"
                            title={`${m.slot}: ${m.title} — set a time`}
                          >
                            {m.slot === "side" ? "Side" : m.slot} · {m.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                ))}
              </div>
            </div>
            {/* Rail + columns */}
            <div className="flex max-h-[640px] overflow-y-auto" tabIndex={0} aria-label="Planner grid, 06:00 to 24:00">
              <TimeRail hourPx={HOUR_PX} />
              <div className={`grid flex-1 ${cols} gap-1.5`}>
                {dates.map((d) => {
                  const past = d < today;
                  const sel = selecting?.date === d ? selecting : null;
                  const preview = sel
                    ? sel.moved
                      ? dragRange(sel.a, sel.b)
                      : dragRange(sel.a, sel.a, { minDur: focusDefault })
                    : hover?.date === d
                      ? hover
                      : creating?.date === d
                        ? creating
                        : null;
                  const pspan = preview ? railSpan(preview.startMin, preview.durationMin) : null;
                  return (
                    <div
                      key={d}
                      data-day-column
                      className={`relative select-none rounded-[14px] ${d === today ? "bg-lime-soft/40" : "bg-surface-2/50"} ${past ? "" : "cursor-crosshair"}`}
                      style={{ height: RAIL_PX }}
                      onPointerDown={(e) => onPointerDown(e, d)}
                      onPointerMove={(e) => onPointerMove(e, d)}
                      onPointerUp={() => onPointerUp(d)}
                      onPointerCancel={() => setSelecting(null)}
                      onDragOver={(e) => onDragOver(e, d)}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover((h) => (h?.date === d ? null : h));
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
                            className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-[12px] bg-line/80 p-2 text-[11px] font-semibold text-ink-2"
                            style={{ top: span.top * RAIL_PX, height: span.height * RAIL_PX }}
                          >
                            {a.name}
                            <span className="tnum block font-medium">
                              {a.startTime}–{a.endTime}
                            </span>
                          </div>
                        );
                      })}
                      {live(d)
                        .filter((m) => m.plannedStart)
                        .map((m) => (
                          <PlannedBlock
                            key={m.id}
                            mission={m}
                            area={areaOf(m.id, null)}
                            onOpen={() => setPlanning(m)}
                            onDragStart={(e) => startDrag(e, m)}
                            onDragEnd={endDrag}
                            onResize={(min) => void resize(m, min)}
                          />
                        ))}
                      {focus.map((f) => (
                        <FocusBlock key={f.id} session={f} date={d} areaOf={areaOf} missions={missions} now={now} />
                      ))}
                      {preview && pspan && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-1 z-30 rounded-[12px] border-2 border-dashed border-lavender-deep bg-lavender-soft/70 p-2 text-[11px] font-semibold text-on-accent"
                          style={{ top: pspan.top * RAIL_PX, height: Math.max(24, pspan.height * RAIL_PX) }}
                        >
                          <span className="tnum">{rangeLabel(preview.startMin, preview.durationMin)}</span>
                        </div>
                      )}
                      {d === today && nowSpan && <NowLine top={nowSpan.top * RAIL_PX} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BacklogPanel backlog={backlog} onPlan={setPlanning} onDragStart={startDrag} onDragEnd={endDrag} />

      <PlanDialog
        mission={planning}
        dates={dates}
        onClose={() => setPlanning(null)}
        onPlace={async (p) => {
          setPlanning(null);
          await place(p);
        }}
      />
      <CreateDialog
        draft={creating}
        dates={dates.filter((d) => d >= today)}
        missionsOn={live}
        goals={goals}
        onClose={() => setCreating(null)}
        onCreate={async (next) => {
          setCreating(null);
          await saveOrAsk(null, next, `Add "${next.title}" to ${formatDay(next.dayDate ?? today)} (locked day)`, `Added ${next.slot === "side" ? "side quest" : next.slot} for ${formatDay(next.dayDate ?? today)}.`);
        }}
      />
      <LockReasonDialog
        open={pending !== null}
        summary={pending?.summary}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending) return;
          await pending.save(reason);
          setPending(null);
        }}
      />
    </div>
  );
}

/** A mission with a planned start: drag to move, drag the bottom edge to resize, click to edit time. */
function PlannedBlock(props: {
  mission: Mission;
  area: Area | null;
  onOpen: () => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onResize: (minutes: number) => void;
}) {
  const m = props.mission;
  const startMin = toMinutes(m.plannedStart ?? "09:00");
  const [dur, setDur] = useState<number | null>(null);
  const column = useRef<Element | null>(null);
  const duration = dur ?? m.estMin ?? 30;
  const span = railSpan(startMin, duration);
  if (!span) return null;
  const c = areaColor(props.area, 0);

  function onHandleDown(e: ReactPointerEvent<HTMLSpanElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    column.current = e.currentTarget.closest("[data-day-column]");
    e.currentTarget.setPointerCapture(e.pointerId);
    setDur(duration);
  }
  function onHandleMove(e: ReactPointerEvent<HTMLSpanElement>) {
    if (dur === null || !column.current) return;
    setDur(resizeTo(startMin, fractionIn(column.current, e.clientY)));
  }
  function onHandleUp(e: ReactPointerEvent<HTMLSpanElement>) {
    e.stopPropagation();
    if (dur !== null) props.onResize(dur);
    setDur(null);
  }

  return (
    <div className="absolute inset-x-1 z-10" style={{ top: span.top * RAIL_PX, height: Math.max(28, span.height * RAIL_PX) }}>
      <button
        type="button"
        draggable
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        onClick={props.onOpen}
        className="block h-full w-full text-left"
        aria-label={`${m.slot} ${m.title}, ${rangeLabel(startMin, duration)}. Change time or length`}
      >
        <AreaBlock
          planned
          compact
          tag={props.area?.name ?? m.slot}
          title={m.title}
          time={dur !== null ? rangeLabel(startMin, dur) : `${m.plannedStart}${m.estMin ? ` · ${durationLabel(m.estMin)}` : ""}`}
          fill={props.area ? c.fill : "#E9E7F8"}
          deep={props.area ? c.deep : "#6E66B8"}
        />
      </button>
      <span
        aria-hidden="true"
        title="Drag to change the length"
        className="group absolute inset-x-2 -bottom-1 z-20 flex h-3 cursor-ns-resize items-center justify-center"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={() => setDur(null)}
      >
        <span className={`h-1 w-8 rounded-full bg-lavender-deep transition-opacity ${dur !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
      </span>
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
    <div className="pointer-events-none absolute left-3 right-1 z-[15]" style={{ top: span.top * RAIL_PX, height: Math.max(22, span.height * RAIL_PX) }}>
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

function BacklogPanel(props: {
  backlog: readonly Mission[];
  onPlan: (m: Mission) => void;
  onDragStart: (e: DragEvent<HTMLElement>, m: Mission) => void;
  onDragEnd: () => void;
}) {
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
              onDragStart={(e) => props.onDragStart(e, m)}
              onDragEnd={props.onDragEnd}
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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const parseMinutes = (v: string): number | null => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 5 && n <= 18 * 60 ? n : null;
};

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
  const [minutes, setMinutes] = useState(String(m.estMin ?? 30));
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const est = parseMinutes(minutes);
    if (!TIME.test(time) || est === null) return;
    void props.onPlace({ mission: m, date, plannedStart: time, estMin: est });
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
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
        <div>
          <label htmlFor="plan-min" className="label">
            Minutes
          </label>
          <input id="plan-min" className="input tnum" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} />
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

function CreateDialog(props: {
  draft: Draft | null;
  dates: readonly ISODate[];
  missionsOn: (d: ISODate) => Mission[];
  goals: readonly { id: string; name: string; status: string }[];
  onClose: () => void;
  onCreate: (next: Mission) => void | Promise<void>;
}) {
  const d = props.draft;
  return (
    <Modal open={d !== null} onClose={props.onClose} title="New mission" description={d ? `${formatDay(d.date)} · ${rangeLabel(d.startMin, d.durationMin)}` : undefined}>
      {d && (
        <CreateForm draft={d} dates={props.dates} missionsOn={props.missionsOn} goals={props.goals} onClose={props.onClose} onCreate={props.onCreate} />
      )}
    </Modal>
  );
}

function CreateForm(props: {
  draft: Draft;
  dates: readonly ISODate[];
  missionsOn: (d: ISODate) => Mission[];
  goals: readonly { id: string; name: string; status: string }[];
  onClose: () => void;
  onCreate: (next: Mission) => void | Promise<void>;
}) {
  const [date, setDate] = useState<ISODate>(props.draft.date);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(hhmmOf(props.draft.startMin));
  const [minutes, setMinutes] = useState(String(props.draft.durationMin));
  const [goalId, setGoalId] = useState("");
  const [minimum, setMinimum] = useState("");
  const [ifThen, setIfThen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onDay = props.missionsOn(date);
  const used = new Set(onDay.map((m) => m.slot));
  const free: Slot[] = [...RANKED_SLOTS.filter((s) => !used.has(s)), ...(used.has("side") ? [] : (["side"] as const))];
  const suggested: Slot | null = firstFreeRanked(onDay) ?? (free.includes("P1") ? "P1" : free.includes("side") ? "side" : null);
  const [slot, setSlot] = useState<Slot | null>(suggested);
  const chosen = slot && free.includes(slot) ? slot : suggested;
  const isP1 = chosen === "P1";
  const dateChoices = props.dates.includes(props.draft.date) ? props.dates : [props.draft.date, ...props.dates];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const est = parseMinutes(minutes);
    if (!title.trim()) return setError("Give it a title.");
    if (!chosen) return setError("That day already has nine missions and a side quest. Use the backlog.");
    if (!TIME.test(time) || est === null) return setError("Check the start time and the minutes.");
    if (isP1 && (!minimum.trim() || !ifThen.trim())) return setError("P1 needs a Minimum version and an if-then plan.");
    const row = blankMission({
      title: title.trim(),
      dayDate: date,
      slot: chosen,
      status: "open",
      plannedStart: time,
      estMin: est,
      goalId: goalId || null,
      minimum: isP1 ? minimum.trim() : null,
      ifThen: isP1 ? ifThen.trim() : null,
    });
    await props.onCreate({ ...row, updatedAt: new Date().toISOString(), deletedAt: null });
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="new-title" className="label">
          Mission
        </label>
        <input id="new-title" className="input" autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="new-day" className="label">
            Day
          </label>
          <select id="new-day" className="input" value={date} onChange={(e) => setDate(e.target.value)}>
            {dateChoices.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-slot" className="label">
            Slot
          </label>
          <select id="new-slot" className="input" value={chosen ?? ""} onChange={(e) => setSlot(e.target.value as Slot)} disabled={free.length === 0}>
            {free.length === 0 && <option value="">Day is full</option>}
            {free.map((s) => (
              <option key={s} value={s}>
                {s === "side" ? "Side quest" : s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-time" className="label">
            Start
          </label>
          <input id="new-time" type="time" step={900} className="input tnum" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new-min" className="label">
            Minutes
          </label>
          <input id="new-min" className="input tnum" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} />
        </div>
      </div>
      {isP1 && (
        <div className="grid gap-3 rounded-card-inner bg-surface-2 p-4">
          <div>
            <label htmlFor="new-minimum" className="label">
              Minimum version
            </label>
            <input id="new-minimum" className="input" maxLength={200} value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="The smallest thing that still counts" />
          </div>
          <div>
            <label htmlFor="new-ifthen" className="label">
              If-then plan
            </label>
            <input id="new-ifthen" className="input" maxLength={300} value={ifThen} onChange={(e) => setIfThen(e.target.value)} placeholder="If it's 7:00 and I've had tea, then I start" />
          </div>
        </div>
      )}
      {props.goals.length > 0 && (
        <div>
          <label htmlFor="new-goal" className="label">
            Goal (optional)
          </label>
          <select id="new-goal" className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {props.goals
              .filter((g) => g.status === "active")
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!title.trim() || !chosen}>
          Add mission
        </button>
      </div>
    </form>
  );
}
