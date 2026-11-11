import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDays,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  monthRange,
  parseIsoWeek,
  themeFor,
  type Experiment,
  type ISODate,
  type MetricBox,
  type MonthStats,
  type Review,
  type WeekStats,
} from "@tatakae/core";
import { useAreas, useMonthStats, useToday, useWeekStats } from "../src/lib/hooks";
import {
  saveArea,
  saveExperiment,
  saveReview,
  shiftMonth,
  useCapacityRange,
  useExperiments,
  useMuraEvents,
  useReviews,
  type ReviewFields,
} from "../src/lib/reviews";
import { longDate, monthTitle, shortDate } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { Kural } from "../src/components/Kural";
import { MetricCard } from "../src/components/MetricCard";
import { MonthCalendar } from "../src/components/MonthCalendar";
import { PillBar } from "../src/components/PillBar";
import { SegmentedPills } from "../src/components/SegmentedPills";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { Stepper } from "../src/components/fitnessUi";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../src/lib/theme";

// Reviews on the phone (website: Weekly Control Room + Monthly review). Weekly: stats first, then Muri (overload) →
// Mura (unevenness) → Muda (waste) → reflection and energy check → one experiment → complete (which unlocks one
// reward episode). Monthly: the month at a glance, reflection, area alignment and next month's theme.

type Period = "week" | "month";

export default function Review() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const params = useLocalSearchParams<{ period?: string }>();
  const [period, setPeriod] = useState<Period>(params.period === "month" ? "month" : "week");
  return (
    <Screen sheet>
      <SheetHeader title={period === "week" ? "Weekly review" : "Monthly review"} onClose={() => router.back()} />
      <SegmentedPills
        accessibilityLabel="Review period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        stretch
      />
      {period === "week" ? <Weekly today={today} /> : <Monthly today={today} />}
      <Text style={s.small}>Reviews are written here or on the laptop; both stay in step.</Text>
    </Screen>
  );
}

// ---------- weekly ----------

function Weekly({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const [week, setWeek] = useState(() => isoWeek(today));
  const { start, end } = isoWeekRange(week.year, week.week);
  const { data: stats } = useWeekStats(week);
  const { data: reviews = [] } = useReviews();
  const existing = reviews.find((r) => r.type === "week" && r.periodStart === start) ?? null;
  const go = (n: number) => setWeek(parseIsoWeek(formatIsoWeek(isoWeek(addDays(start, n * 7)))) ?? week);

  return (
    <>
      <Stepper
        minusLabel="Previous week"
        plusLabel="Next week"
        onMinus={() => go(-1)}
        onPlus={() => go(1)}
        value={
          <View style={s.center}>
            <Text style={s.heading}>Week {week.week}</Text>
            <Text style={s.small}>
              {shortDate(start)} – {shortDate(end)}
            </Text>
          </View>
        }
      />
      {stats ? (
        <>
          <WeekBoxes stats={stats} />
          <WeekForm key={existing?.id ?? start} start={start} end={end} stats={stats} existing={existing} />
          <Kural n={620} meaning={false} />
        </>
      ) : (
        <Text style={s.body}>Opening…</Text>
      )}
    </>
  );
}

function WeekBoxes({ stats }: { stats: WeekStats }) {
  const closed = stats.days.filter((d) => d.final != null);
  const shown = stats.days.filter((d) => d.state === "Strong" || d.state === "Solid" || d.state === "Light").length;
  const boxes: MetricBox[] = [
    { key: "avg_7d", label: "Average score", value: stats.average, unit: "", delta: null, target: 80, progress: stats.average, context: stats.summary },
    {
      key: "days_shown_up",
      label: "Days shown up",
      value: shown,
      unit: "",
      delta: null,
      target: closed.length || null,
      progress: closed.length ? Math.round((100 * shown) / closed.length) : null,
      context: `of ${closed.length} closed ${closed.length === 1 ? "day" : "days"}`,
    },
    { key: "focus_week", label: "Focus", value: stats.focusMinutes, unit: "min", delta: null, target: null, progress: null, context: `${stats.areaMinutes.length} ${stats.areaMinutes.length === 1 ? "area" : "areas"}` },
    { key: "habits_week", label: "Habits", value: stats.habitsPct, unit: "%", delta: null, target: 100, progress: stats.habitsPct, context: "of due checks" },
  ];
  return (
    <>
      {boxes.map((b, i) => (
        <MetricCard key={b.key} box={b} tone="surface2" bar={i % 2 ? "lavender" : "lime"} />
      ))}
    </>
  );
}

function WeekForm(props: { start: ISODate; end: ISODate; stats: WeekStats; existing: Review | null }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const ex = props.existing;
  const { data: capacity = [] } = useCapacityRange(props.start, props.end);
  const { data: mura = [] } = useMuraEvents(props.start, props.end);
  const [f2, setF] = useState({
    wins: ex?.wins ?? "",
    failed: ex?.failed ?? "",
    why: ex?.why ?? "",
    muri: ex?.muri ?? "",
    mura: ex?.mura ?? "",
    muda: ex?.muda ?? "",
    diagnosis: ex?.diagnosis ?? "",
    bottleneck: ex?.bottleneck ?? "",
    theme: ex?.theme ?? "",
  });
  const [scales, setScales] = useState({ capacity: ex?.capacity ?? null, burnout: ex?.burnout ?? null, capability: ex?.capability ?? null });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f2) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const over = capacity.filter((x) => x.planned > x.budget && x.planned > 0);
  const st = props.stats;

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const n = (v: string) => v.trim() || null;
      const fields: ReviewFields = {
        type: "week",
        periodStart: props.start,
        periodEnd: props.end,
        wins: n(f2.wins),
        failed: n(f2.failed),
        why: n(f2.why),
        muri: n(f2.muri),
        mura: n(f2.mura),
        muda: n(f2.muda),
        diagnosis: n(f2.diagnosis),
        bottleneck: n(f2.bottleneck),
        theme: n(f2.theme),
        ...scales,
      };
      const show = await saveReview(fields, ex);
      tapDone();
      setNote(show ? `Review complete. Unlocked one episode of ${show}. Enjoy it.` : ex ? "Review updated." : "Review complete. Rest well.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card tone="surface">
        <Text style={s.heading}>1 · Muri: overload</Text>
        <Text style={s.small}>Did the plan ask for more than the time allowed?</Text>
        {over.length === 0 ? (
          <Text style={s.body}>Every day stayed inside its capacity budget.</Text>
        ) : (
          over.map((x) => (
            <Text key={x.date} style={s.body}>
              {shortDate(x.date)} · {x.planned} / {x.budget} min
            </Text>
          ))
        )}
        <TextField label="What would you plan differently?" value={f2.muri} onChangeText={set("muri")} multiline maxLength={2000} />
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>2 · Mura: unevenness</Text>
        <Text style={s.small}>Where did the plan wobble: lock edits and stuck moments.</Text>
        <PillBar
          label={`Stuck this week: ${st.stuck.uncertainty} uncertainty, ${st.stuck.fear} fear, ${st.stuck.inertia} inertia`}
          empty="No stuck moments logged."
          parts={[
            { label: "Uncertainty", value: st.stuck.uncertainty, fill: c.area.sky, deep: c.lavenderDeep },
            { label: "Fear", value: st.stuck.fear, fill: c.lavender, deep: c.lavenderDeep },
            { label: "Inertia", value: st.stuck.inertia, fill: c.lime, deep: c.limeDeep },
          ]}
        />
        {mura.length > 0 ? (
          mura.slice(0, 6).map((m) => (
            <Text key={m.id} style={s.body}>
              {m.title}: {m.reason}
            </Text>
          ))
        ) : (
          <Text style={s.small}>No locked-plan edits.</Text>
        )}
        <TextField label="What made it uneven?" value={f2.mura} onChangeText={set("mura")} multiline maxLength={2000} />
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>3 · Muda: waste</Text>
        <Text style={s.small}>What took time and gave nothing back?</Text>
        <Text style={s.body}>Screen time averaged {st.screenAvg ?? "—"} min a day.</Text>
        {st.rescheduledTwice.length > 0 ? (
          st.rescheduledTwice.map((m) => (
            <Text key={m.id} style={s.body}>
              {m.title}: moved {m.count}×. Shrink it, or drop it.
            </Text>
          ))
        ) : (
          <Text style={s.small}>Nothing was moved twice.</Text>
        )}
        <TextField label="What will you cut?" value={f2.muda} onChangeText={set("muda")} multiline maxLength={2000} />
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>Reflection</Text>
        <TextField label="Wins" value={f2.wins} onChangeText={set("wins")} multiline maxLength={2000} />
        <TextField label="Not this time" value={f2.failed} onChangeText={set("failed")} multiline maxLength={2000} />
        <TextField label="Why" value={f2.why} onChangeText={set("why")} multiline maxLength={2000} />
        <TextField label="Diagnosis" hint="One sentence: what's really going on?" value={f2.diagnosis} onChangeText={set("diagnosis")} multiline maxLength={2000} />
        <TextField label="Bottleneck" value={f2.bottleneck} onChangeText={set("bottleneck")} maxLength={2000} />
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>Energy check</Text>
        <Scale label="Capacity" value={scales.capacity} onChange={(v) => setScales((x) => ({ ...x, capacity: v }))} low="Empty" high="Plenty" />
        <Scale label="Burnout" value={scales.burnout} onChange={(v) => setScales((x) => ({ ...x, burnout: v }))} low="Fresh" high="Fried" />
        <Scale label="Capability" value={scales.capability} onChange={(v) => setScales((x) => ({ ...x, capability: v }))} low="Out of depth" high="Sharp" />
      </Card>

      <ExperimentCard today={props.end} />

      <BigButton label={ex ? "Save review" : "Complete review"} variant="accent" size="large" busy={busy} onPress={() => void submit()} />
      <Text style={s.small}>{note ?? (ex ? "Saved. Edit anything and save again." : "Completing the review unlocks one episode from your reward queue.")}</Text>
    </>
  );
}

/** 0–10 scale as a wrapping row of round 44dp buttons. Tap the chosen one again to clear it. */
function Scale(props: { label: string; value: number | null; onChange: (v: number | null) => void; low: string; high: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.group} accessibilityRole="radiogroup" accessibilityLabel={props.label}>
      <Text style={s.label}>{props.label}</Text>
      <View style={s.scale}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pressable
            key={n}
            onPress={() => {
              tapLight();
              props.onChange(props.value === n ? null : n);
            }}
            accessibilityRole="radio"
            accessibilityLabel={`${props.label} ${n}`}
            accessibilityState={{ checked: props.value === n }}
            style={({ pressed }) => [s.scaleBtn, props.value === n && s.scaleOn, pressed && pressedStyle]}
          >
            <Text style={[s.scaleText, props.value === n && s.scaleTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.between}>
        <Text style={s.small}>{props.low}</Text>
        <Text style={s.small}>{props.high}</Text>
      </View>
    </View>
  );
}

/** One experiment at a time, two weeks by default. Close the running one with a result and decision. */
function ExperimentCard({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const { data: experiments = [] } = useExperiments();
  const running = experiments.find((e) => e.decision == null && e.end >= today) ?? experiments.find((e) => e.decision == null);
  return (
    <Card tone="surface">
      <Text style={s.heading}>Experiment</Text>
      {running ? <CloseExperiment key={running.id} exp={running} /> : <StartExperiment today={today} />}
    </Card>
  );
}

function CloseExperiment({ exp }: { exp: Experiment }) {
  const s = useStyles(makeStyles);
  const [result, setResult] = useState(exp.result ?? "");
  const [decision, setDecision] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Text style={s.cardTitle}>{exp.hypothesis}</Text>
      <Text style={s.small}>
        Change: {exp.change} · {longDate(exp.start)} – {longDate(exp.end)}
      </Text>
      <TextField label="Result so far" value={result} onChangeText={setResult} multiline maxLength={2000} />
      <TextField label="Decision (keep, tweak, drop) — closes it" value={decision} onChangeText={setDecision} maxLength={500} />
      <BigButton
        label={decision.trim() ? "Close experiment" : "Save result"}
        variant="secondary"
        onPress={async () => {
          await saveExperiment({ ...exp, result: result.trim() || null, decision: decision.trim() || null });
          tapDone();
          setMsg(decision.trim() ? "Experiment closed." : "Result saved.");
        }}
      />
      {msg ? <Text style={s.small}>{msg}</Text> : null}
    </>
  );
}

function StartExperiment({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const [hypothesis, setHypothesis] = useState("");
  const [change, setChange] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Text style={s.small}>One change for the next two weeks. Small enough to keep.</Text>
      <TextField label="If I…" value={change} onChangeText={setChange} maxLength={500} placeholder="charge the phone in the hall" />
      <TextField label="…then I expect" value={hypothesis} onChangeText={setHypothesis} maxLength={500} placeholder="screen time under 120 on 5 of 7 days" />
      <BigButton
        label="Start experiment"
        variant="secondary"
        disabled={!hypothesis.trim() || !change.trim()}
        onPress={async () => {
          await saveExperiment({ hypothesis: hypothesis.trim(), change: change.trim(), start: addDays(today, 1), end: addDays(today, 14), result: null, decision: null });
          tapDone();
          setMsg("Experiment starts tomorrow. Two weeks.");
        }}
      />
      {msg ? <Text style={s.small}>{msg}</Text> : null}
    </>
  );
}

// ---------- monthly ----------

function Monthly({ today }: { today: ISODate }) {
  const s = useStyles(makeStyles);
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data: stats } = useMonthStats(month);
  const { data: reviews = [] } = useReviews();
  const { start } = monthRange(month);
  const existing = reviews.find((r) => r.type === "month" && r.periodStart === start) ?? null;
  return (
    <>
      <Stepper
        minusLabel="Previous month"
        plusLabel="Next month"
        onMinus={() => setMonth(shiftMonth(month, -1))}
        onPlus={() => setMonth(shiftMonth(month, 1))}
        value={<Text style={s.heading}>{monthTitle(month)}</Text>}
      />
      {stats ? (
        <>
          <MonthGlance month={month} stats={stats} />
          <MonthForm key={existing?.id ?? start} month={month} stats={stats} existing={existing} />
        </>
      ) : (
        <Text style={s.body}>Opening…</Text>
      )}
    </>
  );
}

function MonthGlance({ month, stats }: { month: string; stats: MonthStats }) {
  const s = useStyles(makeStyles);
  const delta = stats.average != null && stats.previousAverage != null ? stats.average - stats.previousAverage : null;
  const boxes: MetricBox[] = [
    {
      key: "avg_7d",
      label: "Average score",
      value: stats.average,
      unit: "",
      delta,
      target: 80,
      progress: stats.average,
      context: stats.previousAverage != null ? `Last month ${stats.previousAverage} · rest and write-off days left out` : "No earlier month to compare",
    },
  ];
  return (
    <>
      <MetricCard box={boxes[0] as MetricBox} tone="surface2" />
      <Card tone="surface">
        <Text style={s.heading}>Days by mark</Text>
        <Text style={s.body}>
          Strong {stats.marks.Strong} · Solid {stats.marks.Solid} · Light {stats.marks.Light} · Missed {stats.marks.Missed} · Rest {stats.marks.Rest}
        </Text>
        <Text style={s.small}>{stats.summary}</Text>
        <MonthCalendar month={month} days={stats.days} />
        <Text style={s.small}>
          Shown up on {stats.daysShownUp} days · focus {stats.focusMinutes} min · habits {stats.habitsPct ?? "—"}
          {stats.habitsPct != null ? "%" : ""}
        </Text>
      </Card>
    </>
  );
}

function MonthForm(props: { month: string; stats: MonthStats; existing: Review | null }) {
  const s = useStyles(makeStyles);
  const ex = props.existing;
  const { data: areas = [] } = useAreas();
  const nextMonth = shiftMonth(props.month, 1);
  const [wins, setWins] = useState(ex?.wins ?? "");
  const [failed, setFailed] = useState(ex?.failed ?? "");
  const [why, setWhy] = useState(ex?.why ?? "");
  const [theme, setTheme] = useState(ex?.theme ?? themeFor(`${nextMonth}-01`) ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const n = (v: string) => v.trim() || null;
    await saveReview(
      {
        type: "month",
        periodStart: props.stats.start,
        periodEnd: props.stats.end,
        wins: n(wins),
        failed: n(failed),
        why: n(why),
        muri: ex?.muri ?? null,
        mura: ex?.mura ?? null,
        muda: ex?.muda ?? null,
        diagnosis: ex?.diagnosis ?? null,
        bottleneck: ex?.bottleneck ?? null,
        capacity: ex?.capacity ?? null,
        burnout: ex?.burnout ?? null,
        capability: ex?.capability ?? null,
        theme: n(theme),
      },
      ex,
    );
    tapDone();
    setMsg("Monthly review saved.");
  }

  return (
    <>
      <Card tone="surface">
        <Text style={s.heading}>Reflection</Text>
        <TextField label="Wins" value={wins} onChangeText={setWins} multiline maxLength={2000} />
        <TextField label="Not this time" value={failed} onChangeText={setFailed} multiline maxLength={2000} />
        <TextField label="Why" value={why} onChangeText={setWhy} multiline maxLength={2000} />
      </Card>
      <Card tone="surface">
        <Text style={s.heading}>Area alignment</Text>
        <Text style={s.small}>How well did this month serve each area's why? 0–10.</Text>
        {areas.length === 0 ? (
          <Text style={s.small}>Add areas in Settings to score alignment.</Text>
        ) : (
          areas.map((a) => (
            <Scale
              key={a.id}
              label={a.name}
              value={a.alignmentScore}
              onChange={(v) => void saveArea({ ...a, alignmentScore: v })}
              low="Not at all"
              high="Fully"
            />
          ))
        )}
        <TextField label="Next month's theme" value={theme} onChangeText={setTheme} maxLength={200} placeholder="e.g. Kubernetes" />
      </Card>
      <BigButton label={ex ? "Save review" : "Complete review"} variant="accent" size="large" onPress={() => void submit()} />
      {msg ? <Text style={s.small}>{msg}</Text> : null}
    </>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(400, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 14, 20), color: c.ink },
    heading: { ...f(600, 17, 24), color: c.ink },
    cardTitle: { ...f(600, 16, 22), color: c.ink },
    center: { alignItems: "center", minWidth: 150 },
    group: { gap: space(0.75) },
    between: { flexDirection: "row", justifyContent: "space-between" },
    scale: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    scaleBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    scaleOn: { backgroundColor: c.hero },
    scaleText: { ...f(600, 14, 20), color: c.ink, fontVariant: ["tabular-nums"] },
    scaleTextOn: { color: c.onHero },
  });
