import { useState } from "react";
import { Link } from "react-router-dom";
import { MICRO_INFO, MICRO_KEYS, isoWeek, remaining, type Food, type FoodLog, type ISODate, type MealSlot } from "@tatakae/core";
import { Kural } from "../../components/Kural";
import { PillBar } from "../../components/PillBar";
import { RingProgress } from "../../components/RingProgress";
import { PlusIcon, TrashIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { WeightTrendChart } from "../../components/WeightTrendChart";
import {
  copyFoodLogs,
  logBody,
  removeFoodLog,
  setFoodLogServings,
  useFitnessDay,
  useIstTime,
  type FitnessDay,
} from "../../lib/hooks";
import { BodyDialog } from "./BodyDialog";
import { FoodAdder, FoodForm } from "./Food";
import { MACRO_TONES, MEALS, hm, mealForTime, mealLabel, microText, n0, n1, pctOf } from "./shared";

// Day tab (design canvas "Fitness · Day"): calories ring, protein, weight, macros, body stats, meals,
// add food and new food. Over target is butter / grey, never red.

const OVER = "#C9A227"; // butter band: over target (3:1 on white), never red
const LIME_DEEP = "#7E9A1E";

export function DayTab({ date, today, onTab }: { date: ISODate; today: ISODate; onTab: (t: "week" | "phase") => void }) {
  const { data } = useFitnessDay(date);
  const time = useIstTime();
  const [meal, setMeal] = useState<MealSlot>(() => mealForTime(time));
  const [bodyOpen, setBodyOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  if (!data) return <p className="text-ink-2">Opening…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <CaloriesCard data={data} onTab={onTab} />
        <ProteinCard data={data} />
        <WeightCard data={data} onLog={() => setBodyOpen(true)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MacrosCard data={data} />
        <BodyCard data={data} date={date} onEdit={() => setBodyOpen(true)} />
      </div>
      <MealsCard data={data} date={date} onAdd={(m) => setMeal(m)} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <FoodAdder data={data} date={date} meal={meal} onMeal={setMeal} onEdit={setEditing} />
        <FoodForm key={editing?.id ?? "new"} food={editing} date={date} meal={meal} onDone={() => setEditing(null)} />
      </div>
      <Kural n={616} size="sm" />
      <BodyDialog open={bodyOpen} onClose={() => setBodyOpen(false)} date={date} body={data.body} previousWeightKg={data.previousWeightKg} />
      {date !== today && <p className="text-sm text-ink-2">You are looking at a past day. Changes here are saved to that day.</p>}
    </div>
  );
}

// ---------- calories ----------

function CaloriesCard({ data, onTab }: { data: FitnessDay; onTab: (t: "week" | "phase") => void }) {
  const eaten = data.totals.kcal;
  const target = data.targets?.kcal ?? data.maintenance.kcal;
  const r = remaining(eaten, target);
  const delta = data.maintenance.kcal - target;
  const week = `W${isoWeek(data.date).week}`;
  const carried = data.maintenance.fromWeek ? `W${data.maintenance.fromWeek.slice(-2)}` : null;
  const kind = data.phase?.kind ?? "recomp";
  const targetLine =
    kind === "cut" && delta > 0
      ? `Target = maintenance − ${n0(delta)} kcal${data.targets?.capped ? "" : `, to lose ${Math.abs(data.phase?.ratePctPerWeek ?? 0)} % a week`}`
      : kind === "bulk" && delta < 0
        ? `Target = maintenance + ${n0(-delta)} kcal, to gain ${data.phase?.ratePctPerWeek ?? 0} % a week`
        : "Target = maintenance";

  return (
    <section aria-labelledby="cal-title" className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cal-title" className="text-sm font-semibold text-ink-2">
          Calories
        </h2>
        <span className="pill bg-surface-2 text-ink">Target {n0(target)} kcal</span>
      </div>
      <div className="flex flex-wrap items-center gap-8">
        <RingProgress
          size={176}
          stroke={16}
          pct={Math.min(100, r.pct)}
          color={r.over ? OVER : LIME_DEEP}
          centre={n0(eaten)}
          caption="kcal eaten"
          label={`${n0(eaten)} of ${n0(target)} kcal eaten`}
        />
        <div className="flex min-w-[240px] flex-1 flex-col gap-3.5">
          <div>
            <p className="tnum text-hero">{n0(Math.abs(r.left))}</p>
            <p className="mt-1.5 text-[15px] text-ink-2">{r.over ? "kcal over today. Tomorrow is a fresh day." : "kcal left today"}</p>
          </div>
          <p className="text-sm leading-relaxed text-ink-2">
            Maintenance <b className="tnum text-ink">{n0(data.maintenance.kcal)}</b>
            {data.maintenance.setForThisWeek ? ` · set for ${week}` : carried ? ` · carried from ${carried}` : " · default"} ·{" "}
            <button type="button" className="link" onClick={() => onTab("week")}>
              {data.maintenance.setForThisWeek ? "Change" : `Set for ${week}`}
            </button>
          </p>
          <p className="text-sm leading-relaxed text-ink-2">{targetLine}</p>
          {data.targets?.capped && (
            <p className="rounded-card-inner bg-surface-2 px-3.5 py-2.5 text-[13px] leading-snug text-ink-2">
              Limit applied: never more than {n0(1000)} kcal under maintenance and never below {n0(1500)} kcal. At this target, about{" "}
              <b className="tnum text-ink">{Math.abs(data.targets.expectedRatePct).toFixed(2)} %</b> a week.
            </p>
          )}
          {!data.phase && (
            <p className="text-sm text-ink-2">
              No phase started yet, so targets sit at maintenance.{" "}
              <button type="button" className="link" onClick={() => onTab("phase")}>
                Start a phase
              </button>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProteinCard({ data }: { data: FitnessDay }) {
  const eaten = Math.round(data.totals.proteinG);
  const target = data.targets?.proteinG ?? null;
  const pct = target ? pctOf(eaten, target) : 0;
  return (
    <section aria-labelledby="protein-title" className="card flex flex-col gap-3">
      <h2 id="protein-title" className="text-sm font-semibold text-ink-2">
        Protein
      </h2>
      <p className="flex items-baseline gap-2">
        <span className="tnum text-hero-sm">{eaten}</span>
        <span className="text-lg font-medium text-ink-2">{target != null ? `/ ${target} g` : "g"}</span>
      </p>
      {target != null ? (
        <>
          <div className="flex items-center gap-2.5">
            <div role="progressbar" aria-label="Protein" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: MACRO_TONES.protein.deep }} />
            </div>
            <span className="tnum text-[13px] font-semibold">{pct} %</span>
          </div>
          <p className="mt-auto text-sm leading-relaxed text-ink-2">
            {eaten >= target ? "Target reached." : `${target - eaten} g to go`}
            <br />
            {data.phase?.proteinGPerKg ?? 2.2} g × {n1(data.trendKg ?? 0)} kg trend weight
          </p>
        </>
      ) : (
        <p className="mt-auto text-sm text-ink-2">Log your weight to get a protein target (2.2 g per kg of trend weight).</p>
      )}
    </section>
  );
}

function WeightCard({ data, onLog }: { data: FitnessDay; onLog: () => void }) {
  const w = data.body?.weightKg ?? null;
  const rate = data.weeklyRatePct;
  const goal = data.phase?.ratePctPerWeek ?? 0;
  const onPace = rate != null && goal !== 0 && Math.sign(rate) === Math.sign(goal);
  return (
    <section aria-labelledby="weight-title" className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="weight-title" className="text-sm font-semibold text-ink-2">
          Weight
        </h2>
        {w == null && (
          <button type="button" className="chip bg-lime text-on-accent" onClick={onLog}>
            Log weight
          </button>
        )}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="tnum text-hero-sm">{w != null ? n1(w) : "—"}</span>
        <span className="text-lg font-medium text-ink-2">kg</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {data.trendKg != null && (
          <span className="text-sm">
            Trend <b className="tnum">{n1(data.trendKg)} kg</b>
          </span>
        )}
        {rate != null && (
          <span className={`pill tnum ${onPace ? "bg-lime text-on-accent" : "bg-surface-2 text-ink-2"}`}>
            <span aria-hidden="true">{rate < 0 ? "↘" : rate > 0 ? "↗" : "→"}</span>
            <span className="sr-only">{rate < 0 ? "down" : rate > 0 ? "up" : "flat"}</span>
            {Math.abs(rate).toFixed(2)} % a week
          </span>
        )}
      </div>
      <div className="mt-auto">
        <WeightTrendChart compact points={data.recentTrend} label="Weigh-ins and trend weight over the last two weeks" />
      </div>
    </section>
  );
}

// ---------- macros ----------

function MacrosCard({ data }: { data: FitnessDay }) {
  const t = data.totals;
  const tg = data.targets;
  const rows = [
    { label: "Protein", eaten: Math.round(t.proteinG), target: tg?.proteinG ?? null, tone: MACRO_TONES.protein },
    { label: "Carbs", eaten: Math.round(t.carbsG), target: tg?.carbsG ?? null, tone: MACRO_TONES.carbs },
    { label: "Fat", eaten: Math.round(t.fatG), target: tg?.fatG ?? null, tone: MACRO_TONES.fat },
    { label: "Fibre", eaten: Math.round(t.fibreG), target: tg?.fibreG ?? data.settings["fitness.fibreTargetG"], tone: MACRO_TONES.fibre },
  ];
  const split = [
    { label: "Protein", value: Math.round(t.proteinG * 4), ...MACRO_TONES.protein },
    { label: "Carbs", value: Math.round(t.carbsG * 4), ...MACRO_TONES.carbs },
    { label: "Fat", value: Math.round(t.fatG * 9), ...MACRO_TONES.fat },
  ];
  return (
    <section aria-labelledby="macros-title" className="card flex flex-col gap-[18px]">
      <div className="flex items-center justify-between">
        <h2 id="macros-title" className="text-sm font-semibold text-ink-2">
          Macros
        </h2>
        <span className="text-[13px] text-ink-2">eaten / target</span>
      </div>
      <div className="grid grid-cols-[72px_minmax(0,1fr)_104px] items-center gap-x-4 gap-y-3.5">
        {rows.map((r) => {
          const pct = r.target ? Math.min(100, pctOf(r.eaten, r.target)) : 0;
          return (
            <div key={r.label} className="contents">
              <span className="text-[15px] font-semibold">{r.label}</span>
              <div
                role="progressbar"
                aria-label={r.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-3.5 overflow-hidden rounded-full bg-surface-2"
              >
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.tone.fill, boxShadow: `inset 0 0 0 1.5px ${r.tone.deep}` }} />
              </div>
              <span className="tnum text-right text-[15px]">
                <b>{r.eaten}</b>
                {r.target != null ? ` / ${r.target} g` : " g"}
              </span>
            </div>
          );
        })}
      </div>
      {t.kcal > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Where today's calories came from</p>
          <PillBar label="Calories from protein, carbs and fat" parts={split} />
        </div>
      )}
      <details open className="border-t border-line pt-3.5">
        <summary className="flex min-h-tap cursor-pointer items-center text-sm font-semibold">More nutrients</summary>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
          {MICRO_KEYS.filter((k) => k !== "fibre").map((k) => (
            <div key={k} className="rounded-card-inner bg-surface-2 px-3.5 py-2.5">
              <p className="text-xs font-medium text-ink-2">{MICRO_INFO[k].label}</p>
              <p className="tnum text-base font-semibold">{microText(k, t.micros[k])}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function BodyCard({ data, date, onEdit }: { data: FitnessDay; date: ISODate; onEdit: () => void }) {
  const s = data.settings;
  const b = data.body;
  const water = b?.waterMl ?? 0;
  const rows = [
    { label: "Steps", value: b?.steps ?? 0, target: s["fitness.stepsTarget"], text: `${n0(b?.steps ?? 0)} / ${n0(s["fitness.stepsTarget"])}`, tone: LIME_DEEP },
    { label: "Water", value: water, target: s["fitness.waterTargetMl"], text: `${(water / 1000).toFixed(2).replace(/\.?0+$/, "") || "0"} / ${s["fitness.waterTargetMl"] / 1000} L`, tone: "#6E66B8" },
    { label: "Sleep", value: b?.sleepMin ?? 0, target: s["fitness.sleepTargetMin"], text: `${hm(b?.sleepMin ?? 0)} / ${hm(s["fitness.sleepTargetMin"])}`, tone: LIME_DEEP },
  ];
  return (
    <section aria-labelledby="body-title" className="card flex flex-col gap-[18px]">
      <h2 id="body-title" className="text-sm font-semibold text-ink-2">
        Today's body
      </h2>
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold">{r.label}</span>
            <span className="tnum text-[15px]">{r.text}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div role="progressbar" aria-label={r.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pctOf(r.value, r.target))} className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pctOf(r.value, r.target))}%`, background: r.tone }} />
            </div>
            {r.label === "Water" && (
              <button type="button" className="chip min-h-tap bg-lavender-soft text-[13px] text-ink" onClick={() => void logBody(date, { waterMl: water + 250 })}>
                +250 ml
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="btn-outline mt-auto" onClick={onEdit}>
        Edit body log
      </button>
    </section>
  );
}

// ---------- meals ----------

function MealsCard({ data, date, onAdd }: { data: FitnessDay; date: ISODate; onAdd: (m: MealSlot) => void }) {
  const toast = useToast();
  const yesterday = data.yesterdayLogs;

  async function copyDay() {
    const n = await copyFoodLogs(yesterday, date);
    toast(n === 0 ? "Nothing logged yesterday to copy." : `Copied ${n} ${n === 1 ? "entry" : "entries"} from yesterday.`);
  }

  return (
    <section aria-labelledby="meals-title" className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="meals-title" className="text-xl font-semibold">
          Meals
        </h2>
        <button type="button" className="btn-secondary" disabled={yesterday.length === 0} onClick={() => void copyDay()}>
          Copy yesterday
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MEALS.map((m) => (
          <MealColumn key={m.slot} slot={m.slot} data={data} date={date} onAdd={() => onAdd(m.slot)} />
        ))}
      </div>
    </section>
  );
}

function MealColumn({ slot, data, date, onAdd }: { slot: MealSlot; data: FitnessDay; date: ISODate; onAdd: () => void }) {
  const toast = useToast();
  const logs = data.logs.filter((l) => l.meal === slot);
  const kcal = logs.reduce((s, l) => s + l.kcal * l.servings, 0);
  const yest = data.yesterdayLogs.filter((l) => l.meal === slot);
  const yestKcal = Math.round(yest.reduce((s, l) => s + l.kcal * l.servings, 0));

  return (
    <div className="flex flex-col gap-3 rounded-card-inner bg-surface-2 p-4" aria-label={mealLabel(slot)}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{mealLabel(slot)}</h3>
        <span className="tnum text-[13px] font-semibold text-ink-2">{logs.length ? `${n0(kcal)} kcal` : "—"}</span>
      </div>
      {logs.length === 0 && <p className="px-0.5 py-2 text-sm text-ink-2">Nothing yet.</p>}
      {logs.map((l) => (
        <LogRow key={l.id} log={l} />
      ))}
      {logs.length === 0 && yest.length > 0 && (
        <button
          type="button"
          className="chip bg-surface text-[13px] text-ink"
          onClick={async () => {
            await copyFoodLogs(yest, date, slot);
            toast(`Copied yesterday's ${mealLabel(slot).toLowerCase()}.`);
          }}
        >
          Copy yesterday's {mealLabel(slot).toLowerCase()} · {n0(yestKcal)}
        </button>
      )}
      <button type="button" className="chip justify-center border border-dashed border-missed text-[13px] text-ink" onClick={onAdd}>
        <PlusIcon size={16} /> Add
      </button>
    </div>
  );
}

function LogRow({ log }: { log: FoodLog }) {
  const total = log.kcal * log.servings;
  return (
    <div className="rounded-field bg-surface px-3.5 py-3">
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{log.name}</p>
          <p className="tnum text-xs text-ink-2">{log.servings === 1 ? "1 serving" : `${log.servings} servings`}</p>
        </div>
        <div className="text-right">
          <p className="tnum text-sm font-semibold">{n0(total)}</p>
          <p className="tnum text-xs text-ink-2">P {Math.round(log.proteinG * log.servings)} g</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          className="icon-btn-sm"
          aria-label={`Fewer servings of ${log.name}`}
          disabled={log.servings <= 0.5}
          onClick={() => void setFoodLogServings(log, Math.max(0.5, log.servings - 0.5))}
        >
          <span aria-hidden="true" className="text-lg font-semibold">−</span>
        </button>
        <button type="button" className="icon-btn-sm" aria-label={`More servings of ${log.name}`} onClick={() => void setFoodLogServings(log, log.servings + 0.5)}>
          <PlusIcon size={18} />
        </button>
        <button type="button" className="icon-btn-sm" aria-label={`Remove ${log.name}`} onClick={() => void removeFoodLog(log.id)}>
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  );
}
