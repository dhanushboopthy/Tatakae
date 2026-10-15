import { useState, type FormEvent } from "react";
import {
  MUSCLE_GROUPS,
  addDays,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  lastSets,
  weeklySetsByMuscle,
  type ISODate,
  type Workout,
  type WorkoutSet,
} from "@tatakae/core";
import { CountBlocks } from "../../components/BlockBarChart";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from "../../components/icons";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { formatDay } from "../../lib/format";
import { logSet, removeSet, removeWorkout, saveWorkout, useTraining, type TrainingData } from "../../lib/hooks";
import { kgText, lastTimeText, parseNum } from "./shared";

// Training tab (design canvas "Fitness · Training"): today's session (sets as chips, "same again" in one tap),
// best lifts as estimated 1RM (Epley), sets per muscle for a week and recent sessions.

const SESSION_NAMES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body"] as const;
const MUSCLE_TONE = { fill: "#A3B56B", deep: "#6E7F35" } as const;

export function TrainingTab({ today }: { today: ISODate }) {
  const { data } = useTraining(today);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  if (!data) return <p className="text-ink-2">Opening…</p>;
  const picked = data.workouts.find((w) => w.id === pickedId) ?? null;
  const selected = picked ?? data.workouts.find((w) => w.date === today) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {selected ? (
          <SessionCard key={selected.id} workout={selected} data={data} today={today} onNew={() => setNewOpen(true)} onGone={() => setPickedId(null)} />
        ) : (
          <section className="card flex flex-col items-start gap-3">
            <h2 className="text-xl font-semibold">No session today</h2>
            <p className="text-sm text-ink-2">Start a session, then log each set in a tap or two.</p>
            <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
              <PlusIcon size={18} /> New session
            </button>
          </section>
        )}
        <StrengthCard data={data} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MuscleCard data={data} today={today} />
        <RecentSessions data={data} selectedId={selected?.id ?? null} onOpen={setPickedId} />
      </div>
      <NewSession open={newOpen} onClose={() => setNewOpen(false)} today={today} onCreated={(w) => setPickedId(w.id)} />
    </div>
  );
}

// ---------- session ----------

function SessionCard({ workout, data, today, onNew, onGone }: { workout: Workout; data: TrainingData; today: ISODate; onNew: () => void; onGone: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const sets = data.sets.filter((s) => s.workoutId === workout.id);
  const groups: { exercise: string; muscle: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    const g = groups.find((x) => x.exercise === s.exercise);
    if (g) g.sets.push(s);
    else groups.push({ exercise: s.exercise, muscle: s.muscle, sets: [s] });
  }
  const nextOrder = sets.reduce((m, s) => Math.max(m, s.order), -1) + 1;

  return (
    <section aria-labelledby="session-title" className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="session-title" className="text-xl font-semibold">
            {workout.name} · {workout.date === today ? "today" : formatDay(workout.date)}
          </h2>
          <p className="tnum mt-0.5 text-sm text-ink-2">
            {sets.length} {sets.length === 1 ? "set" : "sets"} so far{workout.durationMin ? ` · ${workout.durationMin} min` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="icon-btn-sm" aria-label="Edit session" onClick={() => setEditOpen(true)}>
            <PencilIcon size={18} />
          </button>
          <button type="button" className="btn-secondary" onClick={onNew}>
            <PlusIcon size={18} /> New session
          </button>
        </div>
      </div>

      {groups.length === 0 && !adding && <p className="text-sm text-ink-2">No sets yet. Add the first exercise.</p>}
      {groups.map((g) => (
        <ExerciseRow key={g.exercise} group={g} workout={workout} data={data} nextOrder={nextOrder} />
      ))}

      {adding ? (
        <ExerciseForm workout={workout} data={data} nextOrder={nextOrder} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn-outline self-start" onClick={() => setAdding(true)}>
          <PlusIcon size={18} /> Exercise
        </button>
      )}

      <EditSession open={editOpen} onClose={() => setEditOpen(false)} workout={workout} sets={sets} onDeleted={onGone} />
    </section>
  );
}

function ExerciseRow({ group, workout, data, nextOrder }: { group: { exercise: string; muscle: string; sets: WorkoutSet[] }; workout: Workout; data: TrainingData; nextOrder: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const last = group.sets[group.sets.length - 1]!;
  const before = lastSets(group.exercise, data.workouts, data.sets, workout.date);

  return (
    <div className="rounded-card-inner bg-surface-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base font-semibold">{group.exercise}</span>
        <span className="tnum text-[13px] text-ink-2">
          {group.muscle}
          {before.length > 0 ? ` · last time ${lastTimeText(before)}` : ""}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${group.exercise} sets`}>
        {group.sets.map((s, i) => (
          <li key={s.id} className="tnum pill min-h-[36px] bg-surface px-3.5 text-sm text-ink">
            <span className="sr-only">Set {i + 1}: </span>
            {kgText(s.kg)} kg × {s.reps}
          </li>
        ))}
        {!open && (
          <li>
            <button
              type="button"
              className="chip bg-lime text-sm text-on-accent"
              onClick={async () => {
                await logSet({ workoutId: workout.id, exercise: group.exercise, muscle: last.muscle, reps: last.reps, kg: last.kg, order: nextOrder });
              }}
            >
              Same again
            </button>
          </li>
        )}
        {!open && (
          <li>
            <button type="button" className="chip border border-dashed border-missed text-sm text-ink" onClick={() => setOpen(true)}>
              + Set {group.sets.length + 1}
            </button>
          </li>
        )}
        {!open && (
          <li>
            <button
              type="button"
              className="icon-btn-sm bg-surface"
              aria-label={`Remove the last set of ${group.exercise}`}
              onClick={async () => {
                await removeSet(last.id);
                toast("Removed the last set.");
              }}
            >
              <TrashIcon size={18} />
            </button>
          </li>
        )}
      </ul>
      {open && (
        <SetForm
          defaults={{ kg: last.kg, reps: last.reps }}
          label={`Set ${group.sets.length + 1}`}
          onCancel={() => setOpen(false)}
          onSave={async (kg, reps) => {
            await logSet({ workoutId: workout.id, exercise: group.exercise, muscle: last.muscle, reps, kg, order: nextOrder });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SetForm(props: { defaults: { kg: number; reps: number }; label: string; onSave: (kg: number, reps: number) => Promise<void>; onCancel: () => void }) {
  const [kg, setKg] = useState(kgText(props.defaults.kg));
  const [reps, setReps] = useState(String(props.defaults.reps));
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = parseNum(kg);
    const r = parseNum(reps);
    if (k == null || k > 1000) return setProblem("Weight should be a number of kg (0 for bodyweight).");
    if (r == null || r < 1 || r > 200 || !Number.isInteger(r)) return setProblem("Reps should be a whole number from 1 to 200.");
    setProblem(null);
    await props.onSave(k, r);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 flex flex-wrap items-end gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-2">kg</span>
        <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" className="input tnum !w-24" autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-2">Reps</span>
        <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" className="input tnum !w-24" />
      </label>
      <button type="submit" className="btn-primary">
        Add {props.label.toLowerCase()}
      </button>
      <button type="button" className="btn-ghost" onClick={props.onCancel}>
        Cancel
      </button>
      {problem && (
        <p role="alert" className="w-full text-sm font-medium">
          {problem}
        </p>
      )}
    </form>
  );
}

function ExerciseForm({ workout, data, nextOrder, onDone }: { workout: Workout; data: TrainingData; nextOrder: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0]);
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  // Picking a known exercise fills its muscle and the first set of last time (the usual starting point).
  function pick(value: string) {
    setName(value);
    const known = data.exercises.find((x) => x.name.toLowerCase() === value.trim().toLowerCase());
    if (!known) return;
    setMuscle(known.muscle);
    const first = lastSets(known.name, data.workouts, data.sets, workout.date)[0];
    if (first) {
      setKg(kgText(first.kg));
      setReps(String(first.reps));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = parseNum(kg);
    const r = parseNum(reps);
    if (!name.trim()) return setProblem("Give the exercise a name.");
    if (k == null || k > 1000 || r == null || r < 1 || r > 200 || !Number.isInteger(r)) return setProblem("Enter the weight in kg and a whole number of reps for the first set.");
    setProblem(null);
    const known = data.exercises.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    await logSet({ workoutId: workout.id, exercise: known?.name ?? name, muscle, reps: r, kg: k, order: nextOrder });
    onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)} aria-label="Add exercise" className="flex flex-col gap-3 rounded-card-inner border border-dashed border-missed p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Exercise</span>
          <input list="exercise-names" value={name} onChange={(e) => pick(e.target.value)} className="input" autoFocus />
          <datalist id="exercise-names">
            {data.exercises.map((x) => (
              <option key={x.name} value={x.name} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Muscle</span>
          <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className="input">
            {[...new Set([...MUSCLE_GROUPS, muscle])].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">First set: kg</span>
          <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" className="input tnum" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Reps</span>
          <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" className="input tnum" />
        </label>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex gap-2.5">
        <button type="submit" className="btn-primary">
          Add exercise
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- new / edit session ----------

function NewSession({ open, onClose, today, onCreated }: { open: boolean; onClose: () => void; today: ISODate; onCreated: (w: Workout) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New session" description="Name it, then log sets as you go.">
      <SessionForm
        initial={{ name: "", date: today, minutes: "" }}
        submitLabel="Start session"
        onSubmit={async (v) => {
          const w = await saveWorkout({ date: v.date, name: v.name, durationMin: v.minutes });
          onCreated(w);
          onClose();
        }}
        onCancel={onClose}
        suggestions
      />
    </Modal>
  );
}

function EditSession({ open, onClose, workout, sets, onDeleted }: { open: boolean; onClose: () => void; workout: Workout; sets: WorkoutSet[]; onDeleted: () => void }) {
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Edit session">
      <SessionForm
        initial={{ name: workout.name, date: workout.date, minutes: workout.durationMin != null ? String(workout.durationMin) : "" }}
        submitLabel="Save"
        onSubmit={async (v) => {
          await saveWorkout({ id: workout.id, date: v.date, name: v.name, durationMin: v.minutes, note: workout.note });
          onClose();
        }}
        onCancel={onClose}
        onDelete={async () => {
          await removeWorkout(workout, sets);
          toast(`Deleted ${workout.name}.`);
          onDeleted();
          onClose();
        }}
      />
    </Modal>
  );
}

function SessionForm(props: {
  initial: { name: string; date: ISODate; minutes: string };
  submitLabel: string;
  suggestions?: boolean;
  onSubmit: (v: { name: string; date: ISODate; minutes: number | null }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(props.initial.name);
  const [date, setDate] = useState(props.initial.date);
  const [minutes, setMinutes] = useState(props.initial.minutes);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = parseNum(minutes);
    if (!name.trim()) return setProblem("Give the session a name.");
    if (minutes.trim() !== "" && (m == null || m > 1440)) return setProblem("Minutes should be a number.");
    setProblem(null);
    await props.onSubmit({ name, date, minutes: m == null ? null : Math.round(m) });
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className="block">
        <span className="label">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoFocus />
      </label>
      {props.suggestions && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested names">
          {SESSION_NAMES.map((n) => (
            <button key={n} type="button" className="chip bg-surface-2 text-sm text-ink" onClick={() => setName(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">Minutes (optional)</span>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" className="input tnum" />
        </label>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className="btn-primary">
          {props.submitLabel}
        </button>
        <button type="button" className="btn-outline" onClick={props.onCancel}>
          Cancel
        </button>
        {props.onDelete &&
          (confirm ? (
            <button type="button" className="btn-danger" onClick={() => void props.onDelete?.()}>
              Delete this session and its sets
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setConfirm(true)}>
              Delete session
            </button>
          ))}
      </div>
    </form>
  );
}

// ---------- strength, muscles, recent ----------

function StrengthCard({ data }: { data: TrainingData }) {
  const lifts = data.lifts;
  const word = data.phase ? `the ${data.phase.kind === "recomp" ? "recomp" : data.phase.kind} began` : "4 weeks ago";
  const measured = lifts.filter((l) => l.delta != null);
  const holding = measured.filter((l) => (l.delta ?? 0) >= 0).length;
  return (
    <section aria-labelledby="strength-title" className="card flex flex-col gap-3.5">
      <div>
        <h2 id="strength-title" className="text-xl font-semibold">
          Strength
        </h2>
        <p className="text-sm text-ink-2">Estimated one-rep max (Epley) · since {word}</p>
      </div>
      {lifts.length === 0 ? (
        <p className="text-sm text-ink-2">Your best lifts show up here once you have logged a few sets.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lifts.map((l) => (
            <li key={l.exercise} className="flex items-center justify-between gap-3 rounded-card-inner bg-surface-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{l.exercise}</p>
                <p className="tnum text-xs text-ink-2">
                  best {kgText(l.kg)} × {l.reps}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tnum text-xl font-semibold">{Math.round(l.e1rm)} kg</span>
                {l.delta != null && (
                  <span className={`pill tnum ${l.delta > 0 ? "bg-lime text-on-accent" : "bg-surface text-ink-2"}`}>
                    <span aria-hidden="true">{l.delta > 0 ? "↗" : l.delta < 0 ? "↘" : "="}</span>
                    <span className="sr-only">{l.delta > 0 ? "up" : l.delta < 0 ? "down" : "same"}</span>
                    {l.delta > 0 ? "+" : l.delta < 0 ? "−" : ""}
                    {Math.abs(Math.round(l.delta))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.phase?.kind === "cut" && measured.length > 0 && (
        <p className="mt-auto text-sm leading-snug text-ink-2">
          Strength is holding or rising on {holding} of {measured.length} {measured.length === 1 ? "lift" : "lifts"} while you lose {Math.abs(data.phase.ratePctPerWeek)} % a week.
        </p>
      )}
    </section>
  );
}

function MuscleCard({ data, today }: { data: TrainingData; today: ISODate }) {
  const [offset, setOffset] = useState(0);
  const anchor = addDays(today, offset * 7);
  const w = isoWeek(anchor);
  const key = formatIsoWeek(w);
  const { start, end } = isoWeekRange(w.year, w.week);
  const rows = weeklySetsByMuscle(data.workouts, data.sets, key);
  const range = `${formatDay(start).replace(/^\w+ /, "")} – ${formatDay(end).replace(/^\w+ /, "")}`;

  return (
    <section aria-labelledby="muscle-title" className="card flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="muscle-title" className="text-xl font-semibold">
          Sets per muscle
        </h2>
        <div className="flex items-center gap-1.5">
          <button type="button" className="icon-btn-sm" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
            <ChevronLeftIcon />
          </button>
          <span className="tnum min-w-[7rem] text-center text-sm font-semibold">
            W{String(w.week).padStart(2, "0")} · {range}
          </span>
          <button type="button" className="icon-btn-sm disabled:opacity-50" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-2">No sets logged this week.</p>
      ) : (
        <CountBlocks label={`Sets per muscle in week ${w.week}`} items={rows.map((r) => ({ label: r.muscle, count: r.sets, ...MUSCLE_TONE }))} />
      )}
    </section>
  );
}

function RecentSessions({ data, selectedId, onOpen }: { data: TrainingData; selectedId: string | null; onOpen: (id: string) => void }) {
  const recent = data.workouts.slice(0, 6);
  return (
    <section aria-labelledby="recent-title" className="card flex flex-col gap-2.5">
      <h2 id="recent-title" className="text-xl font-semibold">
        Recent sessions
      </h2>
      {recent.length === 0 && <p className="text-sm text-ink-2">No sessions yet.</p>}
      {recent.map((w) => {
        const n = data.sets.filter((s) => s.workoutId === w.id).length;
        return (
          <div key={w.id} className={`flex items-center justify-between gap-3 rounded-card-inner px-4 py-2.5 ${w.id === selectedId ? "bg-lime-soft" : "bg-surface-2"}`}>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{w.name}</p>
              <p className="tnum text-[13px] text-ink-2">
                {formatDay(w.date)}
                {w.durationMin ? ` · ${w.durationMin} min` : ""} · {n} {n === 1 ? "set" : "sets"}
              </p>
            </div>
            <button type="button" className="icon-btn-sm bg-surface" aria-label={`Open ${w.name}, ${formatDay(w.date)}`} onClick={() => onOpen(w.id)}>
              <ChevronRightIcon />
            </button>
          </div>
        );
      })}
    </section>
  );
}
