import { Link } from "react-router-dom";
import { focusMinutes, type ISODate, type MissionStatus } from "@tatakae/core";
import { STATE_LABEL } from "../lib/colors";
import { formatDay } from "../lib/format";
import { useCalendarDay, useFocusSessions, useHabits, useMissionsRange } from "../lib/hooks";
import { DayCircle } from "./DayCircle";
import { CheckIcon, DashIcon, HalfMarkIcon, OpenMarkIcon, RescheduleIcon } from "./icons";
import { SLOT_LABEL } from "./MissionCard";

/** Read-only day sheet (docs/11 §4): score, missions with statuses, habits, screen minutes, answers, focus sessions. */

const STATUS: Record<MissionStatus, { label: string; Icon: typeof CheckIcon; tone: string }> = {
  done: { label: "Done", Icon: CheckIcon, tone: "bg-lime text-on-accent" },
  minimum: { label: "Minimum", Icon: HalfMarkIcon, tone: "hatch-min text-on-accent" },
  missed: { label: "Missed", Icon: DashIcon, tone: "bg-surface-2 text-ink shadow-[inset_0_0_0_1.5px_rgb(var(--missed))]" },
  open: { label: "Open", Icon: OpenMarkIcon, tone: "bg-surface-2 text-ink-2" },
  rescheduled: { label: "Moved", Icon: RescheduleIcon, tone: "bg-surface-2 text-ink-2" },
  backlog: { label: "Backlog", Icon: OpenMarkIcon, tone: "bg-surface-2 text-ink-2" },
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  const s = STATUS[status];
  return (
    <span className={`pill shrink-0 ${s.tone}`}>
      <s.Icon size={14} strokeWidth={2.25} />
      {s.label}
    </span>
  );
}

export function DayDetail({ date, today }: { date: ISODate; today: ISODate }) {
  const { data } = useCalendarDay(date);
  const { data: missions = [] } = useMissionsRange(date, date);
  const { data: habits } = useHabits(date);
  const { data: focus = [] } = useFocusSessions(date, date);
  if (!data) return null;
  const { cal, scored } = data;
  const d = scored.day;
  const answers: [string, string | null | undefined][] = [
    ["Small win", d?.smallWin],
    ["Did I do P1?", d?.qP1],
    ["What made me drift?", d?.qDrift],
    ["What did I practise?", d?.qPractised],
  ];
  const sorted = [...missions].sort((a, b) => ["P1", "P2", "P3", "side"].indexOf(a.slot) - ["P1", "P2", "P3", "side"].indexOf(b.slot));

  return (
    <section aria-labelledby="day-detail-title" className="card space-y-5">
      <header className="flex items-center gap-4">
        <DayCircle date={date} state={cal.state} size={52} />
        <div className="min-w-0 flex-1">
          <h2 id="day-detail-title" className="text-xl font-semibold">
            {formatDay(date, { long: true })}
          </h2>
          <p className="text-sm text-ink-2">{STATE_LABEL[cal.state]}</p>
        </div>
        <div className="text-right">
          <p className="tnum text-hero-sm">{cal.final ?? "—"}</p>
          <p className="text-xs text-ink-2">{cal.final == null ? (date >= today ? "after shutdown" : "no score") : "of 100"}</p>
        </div>
      </header>

      {scored.score.bonus > 0 && cal.final != null && (
        <p className="card-inner text-sm">Includes +{scored.score.bonus} for coming back after a missed day.</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-2">Missions</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing planned.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-card-inner bg-surface-2 px-4 py-3">
                <span className="w-10 shrink-0 text-xs font-bold text-ink-2">{m.slot === "side" ? "Side" : SLOT_LABEL[m.slot]}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="card-inner">
          <dt className="text-xs font-semibold text-ink-2">Screen minutes</dt>
          <dd className="tnum mt-1 text-2xl font-semibold">{cal.screenMin ?? "—"}</dd>
        </div>
        <div className="card-inner">
          <dt className="text-xs font-semibold text-ink-2">Focus</dt>
          <dd className="tnum mt-1 text-2xl font-semibold">
            {cal.focusMin} <span className="text-sm font-medium text-ink-2">min</span>
          </dd>
        </div>
      </dl>

      {habits && habits.habits.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Habits</h3>
          <ul className="flex flex-wrap gap-1.5">
            {habits.habits.map((h) => {
              const done = habits.done[h.id] === true;
              return (
                <li key={h.id} className={`pill ${done ? "bg-lime text-on-accent" : "bg-surface-2 font-medium text-ink-2"}`}>
                  {done && <CheckIcon size={13} strokeWidth={2.5} />}
                  {h.behaviour}
                  <span className="sr-only">{done ? "(done)" : "(not done)"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {answers.some(([, v]) => v?.trim()) && (
        <dl className="space-y-2">
          {answers
            .filter(([, v]) => v?.trim())
            .map(([q, v]) => (
              <div key={q}>
                <dt className="text-xs font-semibold text-ink-2">{q}</dt>
                <dd className="text-sm">{v}</dd>
              </div>
            ))}
        </dl>
      )}

      {focus.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Focus sessions</h3>
          <ul className="space-y-1 text-sm">
            {focus.map((f) => {
              const m = missions.find((x) => x.id === f.missionId);
              return (
                <li key={f.id} className="flex justify-between gap-3">
                  <span className="truncate">{m?.title ?? "Open focus"}</span>
                  <span className="tnum shrink-0 text-ink-2">{f.endedAt ? `${focusMinutes(f)} min` : "running"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {date === today && (
        <Link to="/today" className="btn-secondary w-full">
          Open Today
        </Link>
      )}
    </section>
  );
}
