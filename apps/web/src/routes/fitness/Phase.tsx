import { useState, type FormEvent } from "react";
import {
  CUT_MAX_DEFICIT_KCAL,
  CUT_MIN_KCAL,
  KCAL_PER_KG,
  PHASE_DEFAULTS,
  addDays,
  daysBetween,
  rateToKcalPerDay,
  type FitnessPhase,
  type ISODate,
  type PhaseKind,
} from "@tatakae/core";
import { WeightTrendChart } from "../../components/WeightTrendChart";
import { useToast } from "../../components/Toast";
import { formatDay } from "../../lib/format";
import { endPhase, savePhase, startPhase, useFitnessPhase, type FitnessPhaseView } from "../../lib/hooks";
import { MaintenanceList } from "./Week";
import { n0, n1, parseNum } from "./shared";

// Phase tab (design canvas "Fitness · Phase"): the running phase, today's targets with the sums shown,
// the phase settings, maintenance by week and every phase so far. Cut −1 %/wk, Bulk +0.25 %/wk, Recomp at
// maintenance; protein 2.2 g/kg and fat 0.8 g/kg of trend weight; carbs fill the rest. All editable.

const KINDS: readonly { kind: PhaseKind; name: string; blurb: (rate: number) => string }[] = [
  { kind: "cut", name: "Cut", blurb: (r) => `Lose ${Math.abs(r)} % a week` },
  { kind: "bulk", name: "Bulk", blurb: (r) => `Gain ${Math.abs(r)} % a week` },
  { kind: "recomp", name: "Recomp", blurb: () => "Eat at maintenance" },
];

const kindName = (k: PhaseKind) => KINDS.find((x) => x.kind === k)?.name ?? k;
const shortDate = (d: ISODate) => formatDay(d).replace(/^\w+ /, "");

export function PhaseTab({ today, onTab }: { today: ISODate; onTab: (t: "week") => void }) {
  const { data } = useFitnessPhase(today);
  const [replacing, setReplacing] = useState(false);
  if (!data) return <p className="text-ink-2">Opening…</p>;
  const active = data.active;

  return (
    <div className="space-y-4">
      {active && data.progress ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Hero phase={active} data={data} />
          <Targets data={data} />
        </div>
      ) : (
        <section className="card flex flex-col gap-2">
          <h2 className="text-xl font-semibold">No phase running</h2>
          <p className="text-sm text-ink-2">Start a cut, a bulk or a recomp. Until then targets sit at maintenance.</p>
        </section>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {active && !replacing ? (
          <EditPhase key={active.id} phase={active} today={today} onReplace={() => setReplacing(true)} />
        ) : (
          <StartPhase data={data} today={today} onDone={() => setReplacing(false)} onCancel={active ? () => setReplacing(false) : undefined} />
        )}
        <div className="flex flex-col gap-4">
          <section aria-labelledby="maint-hist-title" className="card flex flex-col gap-2.5">
            <h2 id="maint-hist-title" className="text-lg font-semibold">
              Maintenance by week
            </h2>
            <MaintenanceList runs={data.runs} currentWeek={data.runs[0]?.toWeek ?? ""} />
            <button type="button" className="link self-start text-sm" onClick={() => onTab("week")}>
              Set this week's maintenance
            </button>
          </section>
          <History data={data} today={today} />
        </div>
      </div>
    </div>
  );
}

function Hero({ phase, data }: { phase: FitnessPhase; data: FitnessPhaseView }) {
  const p = data.progress;
  if (!p) return null;
  const goal = phase.kind === "recomp" ? "at maintenance" : `${phase.kind === "cut" ? "lose" : "gain"} ${Math.abs(phase.ratePctPerWeek)} % a week`;
  const changeWord = p.changeKg != null && p.changeKg > 0 ? "Gained" : "Lost";
  return (
    <section aria-labelledby="hero-title" className="flex flex-col gap-5 rounded-card bg-charcoal p-7 text-on-charcoal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-charcoal-2">Current phase</p>
          <h2 id="hero-title" className="mt-1 text-[56px] font-semibold leading-none tracking-tight">
            {kindName(phase.kind)}
          </h2>
          <p className="mt-2 text-base text-on-charcoal-2">
            Week {p.weeks} · since {formatDay(phase.startDate)} · {goal}
          </p>
        </div>
        {p.onPace != null && <span className="pill min-h-[36px] bg-lime px-3.5 text-on-accent">{p.onPace ? "On pace" : "Not at the goal rate"}</span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <Stat label="Start" value={`${n1(p.startKg)} kg`} />
        <Stat label="Trend now" value={p.trendKg != null ? `${n1(p.trendKg)} kg` : "—"} />
        <Stat
          label={changeWord}
          value={p.changeKg != null ? `${n1(Math.abs(p.changeKg))} kg` : "—"}
          extra={p.changePct != null ? `· ${Math.abs(p.changePct).toFixed(1)} %` : undefined}
        />
        <Stat
          label="Average"
          value={p.avgRatePct != null ? `${p.avgRatePct < 0 ? "−" : p.avgRatePct > 0 ? "+" : ""}${Math.abs(p.avgRatePct).toFixed(2)} %` : "—"}
          extra={p.avgRatePct != null ? "/ wk" : undefined}
        />
      </div>
      <WeightTrendChart
        onDark
        points={data.trend}
        goal={phase.kind === "recomp" ? undefined : { from: phase.startDate, fromKg: phase.startWeightKg, ratePctPerWeek: phase.ratePctPerWeek }}
        lineColor="#CDE37A"
        label={`Trend weight since ${formatDay(phase.startDate)}${p.trendKg != null ? `, now ${n1(p.trendKg)} kg` : ""}`}
        height={140}
      />
      <div className="flex flex-wrap gap-4 text-[13px] text-on-charcoal-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-lime dark:bg-lime-deep" />
          Trend weight
        </span>
        {phase.kind !== "recomp" && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-on-charcoal-2" />
            {Math.abs(phase.ratePctPerWeek)} % a week goal
          </span>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-on-charcoal-2">{label}</p>
      <p className="tnum text-[28px] font-semibold leading-tight">
        {value} {extra && <span className="text-base font-normal text-on-charcoal-2">{extra}</span>}
      </p>
    </div>
  );
}

function Targets({ data }: { data: FitnessPhaseView }) {
  const t = data.targets;
  const phase = data.active;
  if (!t || !phase || data.trendKg == null) {
    return (
      <section className="card">
        <h2 className="text-xl font-semibold">Daily targets</h2>
        <p className="mt-2 text-sm text-ink-2">Log your weight to get targets.</p>
      </section>
    );
  }
  const rate = Math.abs(phase.ratePctPerWeek);
  const wantedKcal = rateToKcalPerDay(data.trendKg, rate);
  const weeklyKg = (data.trendKg * rate) / 100;
  const tiles: [string, string][] = [
    ["Protein", `${t.proteinG} g`],
    ["Fat", `${t.fatG} g`],
    ["Carbs", `${t.carbsG} g`],
    ["Fibre", `${t.fibreG} g`],
  ];
  return (
    <section aria-labelledby="targets-title" className="card flex flex-col gap-3.5">
      <h2 id="targets-title" className="text-xl font-semibold">
        Daily targets
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 rounded-card-inner bg-lime-soft px-3.5 py-3 text-ink">
          <p className="text-[13px] font-semibold text-ink-2">Calories</p>
          <p className="tnum text-[32px] font-semibold tracking-tight">
            {n0(t.kcal)} <span className="text-[15px] font-medium text-ink-2">kcal</span>
          </p>
        </div>
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-card-inner bg-surface-2 px-3.5 py-3">
            <p className="text-[13px] font-semibold text-ink-2">{label}</p>
            <p className="tnum text-[22px] font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {phase.kind !== "recomp" && rate > 0 && (
        <p className="border-t border-line pt-3 text-sm leading-relaxed text-ink-2">
          {rate} % of {n1(data.trendKg)} kg = {weeklyKg.toFixed(2)} kg a week
          <br />
          {weeklyKg.toFixed(2)} × {n0(KCAL_PER_KG)} ÷ 7 = <b className="tnum text-ink">{n0(wantedKcal)} kcal</b> a day {phase.kind === "cut" ? "under" : "over"}
          <br />
          {n0(data.maintenance.kcal)} maintenance {phase.kind === "cut" ? "−" : "+"} {n0(wantedKcal)} = <b className="tnum text-ink">{n0(t.kcal)}</b>
          <br />
          Protein {phase.proteinGPerKg} g/kg · fat {phase.fatGPerKg} g/kg · carbs fill the rest
        </p>
      )}
      {phase.kind === "cut" && (
        <p className="rounded-card-inner bg-surface-2 px-3.5 py-3 text-[13px] leading-snug text-ink-2">
          {t.capped ? (
            <>
              Limit applied: never more than {n0(CUT_MAX_DEFICIT_KCAL)} kcal under maintenance, never below {n0(CUT_MIN_KCAL)} kcal. At this target, about{" "}
              <b className="tnum text-ink">{Math.abs(t.expectedRatePct).toFixed(2)} %</b> a week.
            </>
          ) : (
            <>Limit: never more than {n0(CUT_MAX_DEFICIT_KCAL)} kcal under maintenance, never below {n0(CUT_MIN_KCAL)} kcal. Not needed now.</>
          )}
        </p>
      )}
    </section>
  );
}

// ---------- settings ----------

interface Fields {
  kind: PhaseKind;
  rate: string;
  protein: string;
  fat: string;
  weight: string;
}

const preset = (kind: PhaseKind): Pick<Fields, "rate" | "protein" | "fat"> => ({
  rate: String(Math.abs(PHASE_DEFAULTS[kind].ratePctPerWeek)),
  protein: String(PHASE_DEFAULTS[kind].proteinGPerKg),
  fat: String(PHASE_DEFAULTS[kind].fatGPerKg),
});

/** Parse the form: rate is typed as a positive number; the sign comes from the type (cut −, bulk +, recomp 0). */
function parseFields(f: Fields, needWeight: boolean) {
  const rate = f.kind === "recomp" ? 0 : parseNum(f.rate);
  const protein = parseNum(f.protein);
  const fat = parseNum(f.fat);
  const weight = parseNum(f.weight);
  if (rate == null || rate > 3) return "Rate should be between 0 and 3 % a week.";
  if (protein == null || protein > 5) return "Protein should be between 0 and 5 g per kg.";
  if (fat == null || fat > 3) return "Fat should be between 0 and 3 g per kg.";
  if (needWeight && (weight == null || weight < 20 || weight > 400)) return "Enter your starting weight in kg.";
  return { ratePctPerWeek: f.kind === "cut" ? -rate : f.kind === "bulk" ? rate : 0, proteinGPerKg: protein, fatGPerKg: fat, startWeightKg: weight ?? 0 };
}

function KindPicker({ value, rate, onChange }: { value: PhaseKind; rate: number; onChange: (k: PhaseKind) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2.5">
      <legend className="mb-2 text-[13px] font-semibold text-ink-2">Type</legend>
      {KINDS.map((k) => {
        const on = k.kind === value;
        return (
          <button
            key={k.kind}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(k.kind)}
            className={`min-h-[64px] flex-[1_1_180px] rounded-[20px] border-2 px-4 py-3 text-left transition ${
              on ? "border-lime-deep bg-lime text-on-accent" : "border-line bg-surface text-ink hover:bg-surface-2"
            }`}
          >
            <span className="block text-[17px] font-semibold">{k.name}</span>
            <span className={`mt-0.5 block text-[13px] ${on ? "" : "text-ink-2"}`}>{k.blurb(k.kind === "recomp" ? 0 : k.kind === value ? rate : Math.abs(PHASE_DEFAULTS[k.kind].ratePctPerWeek))}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

function NumberFields({ f, set, withWeight }: { f: Fields; set: (p: Partial<Fields>) => void; withWeight?: boolean }) {
  const field = (label: string, key: "rate" | "protein" | "fat" | "weight", disabled = false) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <input value={f[key]} onChange={(e) => set({ [key]: e.target.value })} inputMode="decimal" disabled={disabled} className="input tnum disabled:opacity-50" />
    </label>
  );
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {field("Rate (% of weight a week)", "rate", f.kind === "recomp")}
      {field("Protein (g per kg)", "protein")}
      {field("Fat floor (g per kg)", "fat")}
      {withWeight && field("Starting weight (kg)", "weight")}
    </div>
  );
}

function EditPhase({ phase, today, onReplace }: { phase: FitnessPhase; today: ISODate; onReplace: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Fields>({
    kind: phase.kind,
    rate: String(Math.abs(phase.ratePctPerWeek)),
    protein: String(phase.proteinGPerKg),
    fat: String(phase.fatGPerKg),
    weight: "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (p: Partial<Fields>) => setF((s) => ({ ...s, ...p }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const p = parseFields(f, false);
    if (typeof p === "string") return setProblem(p);
    setProblem(null);
    await savePhase(phase, { kind: f.kind, ratePctPerWeek: p.ratePctPerWeek, proteinGPerKg: p.proteinGPerKg, fatGPerKg: p.fatGPerKg });
    toast("Phase saved.");
  }

  return (
    <form onSubmit={(e) => void save(e)} aria-labelledby="settings-title" className="card flex flex-col gap-4">
      <h2 id="settings-title" className="text-xl font-semibold">
        Phase settings
      </h2>
      <KindPicker value={f.kind} rate={Number(f.rate) || 0} onChange={(k) => set({ kind: k, ...preset(k) })} />
      <NumberFields f={f} set={set} />
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className="btn-primary">
          Save changes
        </button>
        <button type="button" className="btn-outline" onClick={onReplace}>
          End phase and start a new one
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            await endPhase(phase, addDays(today, -1) < phase.startDate ? phase.startDate : addDays(today, -1));
            toast("Phase ended. Targets sit at maintenance until you start another.");
          }}
        >
          End phase
        </button>
      </div>
    </form>
  );
}

function StartPhase({ data, today, onDone, onCancel }: { data: FitnessPhaseView; today: ISODate; onDone: () => void; onCancel?: () => void }) {
  const toast = useToast();
  const weight = data.trendKg ?? data.latestWeightKg;
  const [f, setF] = useState<Fields>({ kind: "cut", ...preset("cut"), weight: weight != null ? n1(weight) : "" });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (p: Partial<Fields>) => setF((s) => ({ ...s, ...p }));

  async function start(e: FormEvent) {
    e.preventDefault();
    const p = parseFields(f, true);
    if (typeof p === "string") return setProblem(p);
    setProblem(null);
    await startPhase({ kind: f.kind, startDate: today, ...p }, data.active);
    toast(`${kindName(f.kind)} started.`);
    onDone();
  }

  return (
    <form onSubmit={(e) => void start(e)} aria-labelledby="start-title" className="card flex flex-col gap-4">
      <h2 id="start-title" className="text-xl font-semibold">
        {data.active ? "Start a new phase" : "Start a phase"}
      </h2>
      <KindPicker value={f.kind} rate={Number(f.rate) || 0} onChange={(k) => set({ kind: k, ...preset(k) })} />
      <NumberFields f={f} set={set} withWeight />
      <p className="text-sm text-ink-2">
        Starts today, {shortDate(today)}.{data.active ? ` The ${kindName(data.active.kind).toLowerCase()} ends yesterday.` : ""}
      </p>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className="btn-primary">
          Start {kindName(f.kind).toLowerCase()}
        </button>
        {onCancel && (
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function History({ data, today }: { data: FitnessPhaseView; today: ISODate }) {
  if (data.phases.length === 0) return null;
  return (
    <section aria-labelledby="phases-title" className="card flex flex-col gap-2.5">
      <h2 id="phases-title" className="text-lg font-semibold">
        All phases
      </h2>
      {data.phases.map((p) => {
        const running = p.endDate == null || p.endDate >= today;
        const weeks = Math.max(1, Math.round((daysBetween(p.startDate, p.endDate ?? today) + 1) / 7));
        const end = data.endWeights[p.id];
        return (
          <div key={p.id} className={`flex items-center justify-between gap-3 rounded-card-inner px-3.5 py-3 ${running ? "bg-lime-soft" : "bg-surface-2"}`}>
            <div>
              <p className="text-[15px] font-semibold">{kindName(p.kind)}</p>
              <p className="text-[13px] text-ink-2">
                {shortDate(p.startDate)} – {p.endDate ? shortDate(p.endDate) : "now"} · {weeks} {weeks === 1 ? "week" : "weeks"}
              </p>
            </div>
            <span className="tnum text-sm font-semibold">
              {n1(p.startWeightKg)} → {end != null ? n1(end) : "—"}
            </span>
          </div>
        );
      })}
    </section>
  );
}
