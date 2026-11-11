import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  PHASE_DEFAULTS,
  addDays,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  monthOf,
  weeklySetsByMuscle,
  type Food,
  type ISODate,
  type FitnessPhase,
  type PhaseKind,
  type Workout,
} from "@tatakae/core";
import {
  endPhase,
  removeFood,
  removeWorkout,
  savePhase,
  setFoodFavourite,
  setMaintenance,
  startPhase,
  updateFood,
  useFitnessMonth,
  useFitnessPhase,
  useFitnessWeek,
  useFoodLibrary,
  useTraining,
} from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { longDate, shortDate, monthTitle } from "../../src/lib/format";
import { shiftMonth } from "../../src/lib/reviews";
import { BigButton } from "../../src/components/BigButton";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { MiniBar, Stepper, fill, hm, n0, parseNum } from "../../src/components/fitnessUi";
import { TextField } from "../../src/components/TextField";
import { tapDone, tapLight } from "../../src/haptics";
import { f, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../../src/lib/theme";

// Fitness overview (website: Fitness → Week, Month, Training, Phase, plus the food library). The Day view is the
// card on Today with its quick-log screens. Every number comes from the same core functions as the website.

type Tab = "week" | "month" | "training" | "phase" | "foods";
const TABS: readonly { value: Tab; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "training", label: "Training" },
  { value: "phase", label: "Phase" },
  { value: "foods", label: "Foods" },
];

const n1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n: number, d = 1) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${Math.abs(n).toFixed(d)}`;

export default function FitnessOverview() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const [tab, setTab] = useState<Tab>("week");
  return (
    <Screen sheet>
      <SheetHeader title="Fitness" subtitle="Week, month, training, phase, foods" onClose={() => router.back()} />
      <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Fitness view">
        {TABS.map((t) => (
          <Chip key={t.value} label={t.label} on={tab === t.value} onPress={() => setTab(t.value)} radio />
        ))}
      </View>
      {tab === "week" ? <WeekTab today={today} /> : null}
      {tab === "month" ? <MonthTab today={today} /> : null}
      {tab === "training" ? <TrainingTab today={today} /> : null}
      {tab === "phase" ? <PhaseTab today={today} /> : null}
      {tab === "foods" ? <FoodsTab /> : null}
    </Screen>
  );
}

function Chip({ label, on, onPress, radio }: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityState={radio ? { checked: on } : { selected: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && pressedStyle]}
    >
      <Text style={s.chipText}>
        {on ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ""}`}>
      <Text style={s.small}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {sub ? <Text style={s.small}>{sub}</Text> : null}
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <Card tone="surface">
      <Text style={s.heading}>{title}</Text>
      {children}
    </Card>
  );
}

// ---------- week ----------

const wk = (key: string) => `W${key.slice(-2)}`;

function WeekTab({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const [anchor, setAnchor] = useState<ISODate>(today);
  const w = isoWeek(anchor);
  const key = formatIsoWeek(w);
  const { start, end } = isoWeekRange(w.year, w.week);
  const { data } = useFitnessWeek(key, today);
  const go = (n: number) => setAnchor(addDays(start, n * 7));
  return (
    <>
      <Stepper
        minusLabel="Previous week"
        plusLabel="Next week"
        onMinus={() => go(-1)}
        onPlus={() => go(1)}
        value={
          <View style={s.center}>
            <Text style={s.heading}>{wk(key)}</Text>
            <Text style={s.small}>
              {shortDate(start)} – {shortDate(end)}
            </Text>
          </View>
        }
      />
      {!data ? (
        <Text style={s.body}>Opening…</Text>
      ) : (
        <>
          <Block title="Calories by day">
            {data.summary.days.map((d) => {
              const target = data.dayTargets[d.date] ?? d.maintenanceKcal;
              const over = d.kcal != null && d.kcal > target;
              return (
                <View key={d.date} style={s.group}>
                  <View style={s.between}>
                    <Text style={s.body}>{shortDate(d.date)}</Text>
                    <Text style={s.small}>{d.kcal == null ? "not logged" : `${n0(d.kcal)} of ${n0(target)}${over ? " (over)" : ""}`}</Text>
                  </View>
                  <MiniBar pct={d.kcal != null && target > 0 ? Math.min(100, (d.kcal / target) * 100) : 0} color={over ? c.butterDeep : c.limeDeep} label={`${shortDate(d.date)} calories`} />
                </View>
              );
            })}
          </Block>
          <MaintenanceCard key={`${key}-${data.summary.maintenanceKcal}-${data.summary.maintenanceSetForWeek}`} weekKey={key} data={data} />
          <Block title="This week in numbers">
            <View style={s.stats}>
              <Stat label="Average eaten" value={data.summary.avgKcal != null ? `${n0(data.summary.avgKcal)} kcal` : "—"} sub={`${data.summary.daysLogged} days logged`} />
              <Stat label="Protein average" value={data.summary.avgProteinG != null ? `${n0(data.summary.avgProteinG)} g` : "—"} />
              <Stat label="Balance" value={`${signed(data.summary.balanceKcal, 0)} kcal`} sub="eaten minus maintenance" />
              <Stat label="Weight rate" value={data.summary.ratePctPerWeek != null ? `${signed(data.summary.ratePctPerWeek, 2)} %` : "—"} sub="a week" />
            </View>
            {data.summary.trendStartKg != null && data.summary.trendEndKg != null ? (
              <Text style={s.small}>
                Trend {n1(data.summary.trendStartKg)} → {n1(data.summary.trendEndKg)} kg
              </Text>
            ) : null}
            <Text style={s.small}>
              Daily averages: steps {data.averages.steps != null ? n0(data.averages.steps) : "—"} · water {data.averages.waterMl != null ? `${(data.averages.waterMl / 1000).toFixed(1)} L` : "—"} · sleep{" "}
              {data.averages.sleepMin != null ? hm(data.averages.sleepMin) : "—"}
            </Text>
          </Block>
          <Block title="Weekly check-in">
            <Text style={s.body}>{data.checkIn}</Text>
          </Block>
        </>
      )}
    </>
  );
}

function MaintenanceCard({ weekKey, data }: { weekKey: string; data: NonNullable<ReturnType<typeof useFitnessWeek>["data"]> }) {
  const s = useStyles(makeStyles);
  const sum = data.summary;
  const [text, setText] = useState(String(sum.maintenanceKcal));
  const [msg, setMsg] = useState<string | null>(null);
  const note = sum.maintenanceSetForWeek
    ? "Set for this week. The next week keeps it until you change it."
    : sum.maintenanceFromWeek
      ? `Carried from ${wk(sum.maintenanceFromWeek)}. Type a number to set it for ${wk(weekKey)}.`
      : "Using the default. Type a number to set it for this week.";
  return (
    <Block title={`Maintenance · ${wk(weekKey)}`}>
      <Text style={s.big}>{n0(sum.maintenanceKcal)} kcal</Text>
      <Text style={s.small}>{note}</Text>
      <TextField label={sum.maintenanceSetForWeek ? "Change for this week" : "Set for this week"} value={text} onChangeText={(v) => setText(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={4} />
      <BigButton
        label="Save maintenance"
        variant="accent"
        onPress={async () => {
          const n = Number(text);
          if (!Number.isInteger(n) || n < 800 || n > 8000) return void setMsg("Enter a number between 800 and 8,000.");
          await setMaintenance(weekKey, n);
          tapDone();
          setMsg(`Maintenance for ${wk(weekKey)} is ${n0(n)} kcal.`);
        }}
      />
      {msg ? <Text style={s.small}>{msg}</Text> : null}
    </Block>
  );
}

// ---------- month ----------

function MonthTab({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const [month, setMonth] = useState(monthOf(today));
  const { data } = useFitnessMonth(month, today);
  return (
    <>
      <Stepper
        minusLabel="Previous month"
        plusLabel="Next month"
        onMinus={() => setMonth(shiftMonth(month, -1))}
        onPlus={() => setMonth(shiftMonth(month, 1))}
        value={<Text style={s.heading}>{monthTitle(month)}</Text>}
      />
      {!data ? (
        <Text style={s.body}>Opening…</Text>
      ) : (
        <>
          <Block title="The month">
            <View style={s.stats}>
              <Stat label="Average eaten" value={data.summary.avgKcal != null ? `${n0(data.summary.avgKcal)} kcal` : "—"} sub={data.summary.avgProteinG != null ? `Protein ${n0(data.summary.avgProteinG)} g` : undefined} />
              <Stat label="Days logged" value={`${data.summary.daysLogged} / ${data.daysElapsed}`} sub={`${data.summary.weighIns} weigh-ins`} />
              <Stat label="At or under target" value={String(data.atOrUnder)} sub={`${data.over} over · ${data.notLogged} not logged`} />
              <Stat
                label="Weight change"
                value={data.summary.weightChangeKg != null ? `${signed(data.summary.weightChangeKg, 1)} kg` : "—"}
                sub={data.summary.ratePctPerWeek != null ? `${signed(data.summary.ratePctPerWeek, 2)} % a week` : undefined}
              />
            </View>
            {data.summary.trendStartKg != null && data.summary.trendEndKg != null ? (
              <Text style={s.small}>
                Trend {n1(data.summary.trendStartKg)} → {n1(data.summary.trendEndKg)} kg
              </Text>
            ) : null}
          </Block>
          <Block title="Week by week">
            {data.summary.weeks.map((wkr) => (
              <View key={wkr.isoWeek} style={s.between}>
                <View style={s.flex}>
                  <Text style={s.body}>{wk(wkr.isoWeek)}</Text>
                  <Text style={s.small}>{wkr.daysLogged} days logged</Text>
                </View>
                <Text style={s.body}>{wkr.avgKcal != null ? `${n0(wkr.avgKcal)} kcal` : "—"}</Text>
                <Text style={s.small}>{wkr.ratePctPerWeek != null ? `${signed(wkr.ratePctPerWeek, 2)} %` : ""}</Text>
              </View>
            ))}
          </Block>
        </>
      )}
    </>
  );
}

// ---------- training ----------

function TrainingTab({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const { data } = useTraining(today);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!data) return <Text style={s.body}>Opening…</Text>;
  const week = formatIsoWeek(isoWeek(today));
  const muscles = weeklySetsByMuscle(data.workouts, data.sets, week);
  const setsOf = (w: Workout) => data.sets.filter((x) => x.workoutId === w.id);
  return (
    <>
      <BigButton label="Log a set" variant="accent" onPress={() => router.push("/fitness/set")} />
      <Block title="Best lifts">
        <Text style={s.small}>Estimated 1RM (Epley), change since {longDate(data.since)}.</Text>
        {data.lifts.length === 0 ? <Text style={s.small}>Log a few sets to see them here.</Text> : null}
        {data.lifts.slice(0, 10).map((l) => (
          <View key={l.exercise} style={s.between}>
            <View style={s.flex}>
              <Text style={s.body}>{l.exercise}</Text>
              <Text style={s.small}>
                {l.kg} kg × {l.reps}
              </Text>
            </View>
            <Text style={s.body}>
              {n1(l.e1rm)} kg{l.delta != null && l.delta !== 0 ? ` (${signed(l.delta, 1)})` : ""}
            </Text>
          </View>
        ))}
      </Block>
      <Block title={`Sets per muscle · ${wk(week)}`}>
        {muscles.length === 0 ? <Text style={s.small}>No sets this week yet.</Text> : null}
        {muscles.map((m) => (
          <View key={m.muscle} style={s.between}>
            <Text style={s.body}>{m.muscle}</Text>
            <Text style={s.body}>{m.sets}</Text>
          </View>
        ))}
      </Block>
      <Block title="Recent sessions">
        {data.workouts.length === 0 ? <Text style={s.small}>No sessions yet.</Text> : null}
        {data.workouts.slice(0, 12).map((w) => (
          <View key={w.id} style={s.group}>
            <View style={s.between}>
              <View style={s.flex}>
                <Text style={s.body}>
                  {w.name} · {shortDate(w.date)}
                </Text>
                <Text style={s.small}>
                  {setsOf(w).length} sets{w.durationMin ? ` · ${w.durationMin} min` : ""}
                </Text>
              </View>
              {confirm === w.id ? (
                <BigButton
                  label="Delete it"
                  variant="danger"
                  size="compact"
                  onPress={async () => {
                    await removeWorkout(w, setsOf(w));
                    setConfirm(null);
                  }}
                />
              ) : (
                <BigButton label="Delete" variant="quiet" size="compact" onPress={() => setConfirm(w.id)} accessibilityLabel={`Delete ${w.name} on ${longDate(w.date)}`} />
              )}
            </View>
          </View>
        ))}
      </Block>
    </>
  );
}

// ---------- phase ----------

const KIND_NAME: Record<PhaseKind, string> = { cut: "Cut", bulk: "Bulk", recomp: "Recomp" };

function PhaseTab({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const { data } = useFitnessPhase(today);
  const [replacing, setReplacing] = useState(false);
  if (!data) return <Text style={s.body}>Opening…</Text>;
  const active = data.active;
  const p = data.progress;
  return (
    <>
      {active && p ? (
        <View style={s.hero}>
          <Text style={s.heroLabel}>Current phase</Text>
          <Text style={s.heroTitle}>{KIND_NAME[active.kind]}</Text>
          <Text style={s.heroSub}>
            Week {p.weeks} · since {longDate(active.startDate)} ·{" "}
            {active.kind === "recomp" ? "at maintenance" : `${active.kind === "cut" ? "lose" : "gain"} ${Math.abs(active.ratePctPerWeek)} % a week`}
          </Text>
          <Text style={s.heroSub}>
            Start {n1(p.startKg)} kg · trend now {p.trendKg != null ? `${n1(p.trendKg)} kg` : "—"}
            {p.changeKg != null ? ` · ${p.changeKg > 0 ? "gained" : "lost"} ${n1(Math.abs(p.changeKg))} kg` : ""}
          </Text>
          {p.onPace != null ? <Text style={s.heroSub}>{p.onPace ? "On pace" : "Not at the goal rate"}</Text> : null}
        </View>
      ) : (
        <Block title="No phase running">
          <Text style={s.small}>Start a cut, a bulk or a recomp. Until then targets sit at maintenance.</Text>
        </Block>
      )}

      {data.targets ? (
        <Block title="Daily targets">
          <Text style={s.big}>{n0(data.targets.kcal)} kcal</Text>
          <Text style={s.small}>
            Protein {data.targets.proteinG} g · fat {data.targets.fatG} g · carbs {data.targets.carbsG} g · fibre {data.targets.fibreG} g
          </Text>
          <BigButton label="Calories and start date" variant="secondary" onPress={() => router.push("/fitness/targets")} />
        </Block>
      ) : null}

      {active && !replacing ? (
        <EditPhase key={active.id} phase={active} today={today} onReplace={() => setReplacing(true)} />
      ) : (
        <StartPhase data={data} today={today} onDone={() => setReplacing(false)} onCancel={active ? () => setReplacing(false) : undefined} />
      )}

      <Block title="Phases so far">
        {data.phases.length === 0 ? <Text style={s.small}>None yet.</Text> : null}
        {data.phases.map((ph) => (
          <View key={ph.id} style={s.between}>
            <View style={s.flex}>
              <Text style={s.body}>{KIND_NAME[ph.kind]}</Text>
              <Text style={s.small}>
                {shortDate(ph.startDate)} – {ph.endDate ? shortDate(ph.endDate) : "now"}
              </Text>
            </View>
            <Text style={s.small}>
              {n1(ph.startWeightKg)} → {data.endWeights[ph.id] != null ? `${n1(data.endWeights[ph.id] as number)} kg` : "—"}
            </Text>
          </View>
        ))}
      </Block>
    </>
  );
}

function KindPicker({ value, onChange }: { value: PhaseKind; onChange: (k: PhaseKind) => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.group}>
      <Text style={s.label}>Type</Text>
      <View style={s.chips}>
        {(Object.keys(KIND_NAME) as PhaseKind[]).map((k) => (
          <Chip key={k} label={KIND_NAME[k]} on={value === k} onPress={() => onChange(k)} />
        ))}
      </View>
    </View>
  );
}

const preset = (kind: PhaseKind) => ({
  rate: String(Math.abs(PHASE_DEFAULTS[kind].ratePctPerWeek)),
  protein: String(PHASE_DEFAULTS[kind].proteinGPerKg),
  fat: String(PHASE_DEFAULTS[kind].fatGPerKg),
});

function parseFields(f2: { kind: PhaseKind; rate: string; protein: string; fat: string; weight: string }, needWeight: boolean) {
  const rate = f2.kind === "recomp" ? 0 : parseNum(f2.rate);
  const protein = parseNum(f2.protein);
  const fat = parseNum(f2.fat);
  const weight = parseNum(f2.weight);
  if (rate == null || rate > 3) return "Rate should be between 0 and 3 % a week.";
  if (protein == null || protein > 5) return "Protein should be between 0 and 5 g per kg.";
  if (fat == null || fat > 3) return "Fat should be between 0 and 3 g per kg.";
  if (needWeight && (weight == null || weight < 20 || weight > 400)) return "Enter your starting weight in kg.";
  return { ratePctPerWeek: f2.kind === "cut" ? -rate : f2.kind === "bulk" ? rate : 0, proteinGPerKg: protein, fatGPerKg: fat, startWeightKg: weight ?? 0 };
}

function Numbers({ f2, set, withWeight }: { f2: { kind: PhaseKind; rate: string; protein: string; fat: string; weight: string }; set: (p: Partial<typeof f2>) => void; withWeight?: boolean }) {
  return (
    <>
      {f2.kind !== "recomp" ? <TextField label="Rate (% of weight a week)" value={f2.rate} onChangeText={(v) => set({ rate: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" maxLength={5} /> : null}
      <TextField label="Protein (g per kg)" value={f2.protein} onChangeText={(v) => set({ protein: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" maxLength={5} />
      <TextField label="Fat floor (g per kg)" value={f2.fat} onChangeText={(v) => set({ fat: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" maxLength={5} />
      {withWeight ? <TextField label="Starting weight (kg)" value={f2.weight} onChangeText={(v) => set({ weight: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" maxLength={6} /> : null}
    </>
  );
}

function EditPhase({ phase, today, onReplace }: { phase: FitnessPhase; today: ISODate; onReplace: () => void }) {
  const s = useStyles(makeStyles);
  const [f2, setF] = useState({ kind: phase.kind, rate: String(Math.abs(phase.ratePctPerWeek)), protein: String(phase.proteinGPerKg), fat: String(phase.fatGPerKg), weight: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<typeof f2>) => setF((x) => ({ ...x, ...p }));
  return (
    <Block title="Phase settings">
      <KindPicker value={f2.kind} onChange={(k) => set({ kind: k, ...preset(k) })} />
      <Numbers f2={f2} set={set} />
      <BigButton
        label="Save changes"
        variant="accent"
        onPress={async () => {
          const p = parseFields(f2, false);
          if (typeof p === "string") return void setMsg(p);
          await savePhase(phase, { kind: f2.kind, ratePctPerWeek: p.ratePctPerWeek, proteinGPerKg: p.proteinGPerKg, fatGPerKg: p.fatGPerKg });
          tapDone();
          setMsg("Phase saved.");
        }}
      />
      <BigButton label="End this phase and start a new one" variant="secondary" onPress={onReplace} />
      <BigButton
        label="End phase"
        variant="quiet"
        size="compact"
        onPress={async () => {
          await endPhase(phase, addDays(today, -1) < phase.startDate ? phase.startDate : addDays(today, -1));
          setMsg("Phase ended. Targets sit at maintenance until you start another.");
        }}
      />
      {msg ? <Text style={s.small}>{msg}</Text> : null}
    </Block>
  );
}

function StartPhase({ data, today, onDone, onCancel }: { data: NonNullable<ReturnType<typeof useFitnessPhase>["data"]>; today: ISODate; onDone: () => void; onCancel?: () => void }) {
  const s = useStyles(makeStyles);
  const weight = data.trendKg ?? data.latestWeightKg;
  const [f2, setF] = useState<{ kind: PhaseKind; rate: string; protein: string; fat: string; weight: string }>({ kind: "cut", ...preset("cut"), weight: weight != null ? n1(weight) : "" });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<typeof f2>) => setF((x) => ({ ...x, ...p }));
  return (
    <Block title={data.active ? "Start a new phase" : "Start a phase"}>
      <KindPicker value={f2.kind} onChange={(k) => set({ kind: k, ...preset(k) })} />
      <Numbers f2={f2} set={set} withWeight />
      <Text style={s.small}>
        Starts today, {longDate(today)}.{data.active ? ` The ${KIND_NAME[data.active.kind].toLowerCase()} ends yesterday.` : ""} You can move the start date afterwards.
      </Text>
      {msg ? (
        <Text accessibilityRole="alert" style={s.body}>
          {msg}
        </Text>
      ) : null}
      <BigButton
        label={`Start ${KIND_NAME[f2.kind].toLowerCase()}`}
        variant="accent"
        onPress={async () => {
          const p = parseFields(f2, true);
          if (typeof p === "string") return void setMsg(p);
          await startPhase({ kind: f2.kind, startDate: today, ...p }, data.active);
          tapDone();
          onDone();
        }}
      />
      {onCancel ? <BigButton label="Cancel" variant="quiet" size="compact" onPress={onCancel} /> : null}
    </Block>
  );
}

// ---------- foods ----------

function FoodsTab() {
  const s = useStyles(makeStyles);
  const { data: foods = [] } = useFoodLibrary();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = foods.filter((x) => words.every((w) => x.name.toLowerCase().includes(w)));
  return (
    <>
      <BigButton label="Add a new food" variant="accent" onPress={() => router.push("/fitness/food")} />
      <TextField label="Search saved foods" value={q} onChangeText={setQ} maxLength={80} />
      {shown.length === 0 ? <Text style={s.small}>{foods.length === 0 ? "No saved foods yet. Add one from the + Food screen." : "Nothing matches."}</Text> : null}
      {shown.map((food) => (
        <FoodRow key={food.id} food={food} open={editing === food.id} onOpen={() => setEditing(editing === food.id ? null : food.id)} />
      ))}
    </>
  );
}

function FoodRow({ food, open, onOpen }: { food: Food; open: boolean; onOpen: () => void }) {
  const s = useStyles(makeStyles);
  const [name, setName] = useState(food.name);
  const [serving, setServing] = useState(food.servingLabel);
  const [kcal, setKcal] = useState(String(food.kcal));
  const [protein, setProtein] = useState(String(food.proteinG));
  const [carbs, setCarbs] = useState(String(food.carbsG));
  const [fat, setFat] = useState(String(food.fatG));
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card tone="surface">
      <View style={s.between}>
        <View style={s.flex}>
          <Text style={s.body}>
            {food.favourite ? "★ " : ""}
            {food.name}
          </Text>
          <Text style={s.small}>
            {food.servingLabel} · {n0(food.kcal)} kcal · P {Math.round(food.proteinG)} · C {Math.round(food.carbsG)} · F {Math.round(food.fatG)}
          </Text>
        </View>
        <BigButton label={open ? "Close" : "Edit"} variant="secondary" size="compact" onPress={onOpen} accessibilityLabel={`${open ? "Close" : "Edit"} ${food.name}`} />
      </View>
      {open ? (
        <>
          <TextField label="Name" value={name} onChangeText={setName} maxLength={120} />
          <TextField label="Serving" value={serving} onChangeText={setServing} maxLength={60} />
          <TextField label="Calories" value={kcal} onChangeText={(v) => setKcal(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" maxLength={7} />
          <TextField label="Protein (g)" value={protein} onChangeText={(v) => setProtein(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" maxLength={6} />
          <TextField label="Carbs (g)" value={carbs} onChangeText={(v) => setCarbs(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" maxLength={6} />
          <TextField label="Fat (g)" value={fat} onChangeText={(v) => setFat(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" maxLength={6} />
          <BigButton
            label="Save food"
            variant="accent"
            disabled={!name.trim()}
            onPress={async () => {
              const k = parseNum(kcal);
              const p = parseNum(protein);
              const c2 = parseNum(carbs);
              const fa = parseNum(fat);
              if (k == null || p == null || c2 == null || fa == null) return void setMsg("Calories and macros should be numbers.");
              await updateFood(food, { name, servingLabel: serving.trim() || "1 serving", kcal: k, proteinG: p, carbsG: c2, fatG: fa });
              tapDone();
              setMsg("Saved. Logs you already made keep their own numbers.");
            }}
          />
          <BigButton label={food.favourite ? "Remove from favourites" : "Make a favourite"} variant="secondary" size="compact" onPress={() => void setFoodFavourite(food, !food.favourite)} />
          {confirm ? (
            <BigButton label="Yes, delete this food" variant="danger" size="compact" onPress={() => void removeFood(food.id)} />
          ) : (
            <BigButton label="Delete food" variant="quiet" size="compact" onPress={() => setConfirm(true)} />
          )}
          {msg ? <Text style={s.small}>{msg}</Text> : null}
        </>
      ) : null}
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink2 },
    heading: { ...f(600, 17, 24), color: c.ink },
    big: { ...f(600, 34, 40), color: c.ink, fontVariant: ["tabular-nums"] },
    center: { alignItems: "center", minWidth: 140 },
    flex: { flex: 1 },
    group: { gap: space(0.5) },
    between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2 },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: space(1.5) },
    stat: { minWidth: "45%", flexGrow: 1, backgroundColor: c.surface2, borderRadius: radius.inner, padding: space(1.5), gap: 2 },
    statValue: { ...f(600, 20, 26), color: c.ink, fontVariant: ["tabular-nums"] },
    // The phase hero keeps its light pastel fill in both themes, so its text is ink in both.
    hero: { backgroundColor: fill.limeSoft, borderRadius: radius.card, padding: space(2.25), gap: space(0.5) },
    heroLabel: { ...f(600, 13, 18), color: fill.inkMuted },
    heroTitle: { ...f(600, 36, 42), color: fill.ink },
    heroSub: { ...f(500, 14, 20), color: fill.ink },
  });
