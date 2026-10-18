import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { DEFAULT_SCORING, DESIGN_SAMPLES as S, type Habit, type Mission, type MissionStatus } from "@tatakae/core";
import type { HabitToday } from "../../src/lib/hooks";
import { AREA_COLORS } from "../../src/lib/colors";
import { setThemePref, useStyles, useTheme, type Theme } from "../../src/lib/theme";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { IconCircle } from "../../src/components/IconCircle";
import { Icon } from "../../src/components/Icon";
import { BigButton } from "../../src/components/BigButton";
import { SegmentedPills } from "../../src/components/SegmentedPills";
import { StatusChips } from "../../src/components/StatusChips";
import { MissionCard } from "../../src/components/MissionCard";
import { P1HeroCard } from "../../src/components/P1HeroCard";
import { DayCircle, DayLegend } from "../../src/components/DayCircle";
import { WeekStrip } from "../../src/components/WeekStrip";
import { MonthCalendar } from "../../src/components/MonthCalendar";
import { MetricCard } from "../../src/components/MetricCard";
import { Scoreboard } from "../../src/components/Scoreboard";
import { HatchedStackBar } from "../../src/components/HatchedStackBar";
import { StripeTrend } from "../../src/components/StripeTrend";
import { Sparkline } from "../../src/components/Sparkline";
import { SegmentGauge } from "../../src/components/SegmentGauge";
import { RingProgress } from "../../src/components/RingProgress";
import { FocusRing } from "../../src/components/FocusRing";
import { BlockBarChart, AreaSplit } from "../../src/components/BlockBarChart";
import { PillBar } from "../../src/components/PillBar";
import { HabitHeatGrid } from "../../src/components/HabitHeatGrid";
import { CapacityBar } from "../../src/components/CapacityBar";
import { HabitStrip } from "../../src/components/HabitStrip";
import { TextField } from "../../src/components/TextField";
import { Kural } from "../../src/components/Kural";
import { Toast } from "../../src/components/Toast";
import { f, space } from "../../src/theme";

const mission = (slot: Mission["slot"], title: string, over: Partial<Mission> = {}): Mission => ({
  id: `sample-${slot}`,
  title,
  dayDate: S.today,
  slot,
  points: null,
  status: "open",
  minimum: "Write the variables file",
  ifThen: "If it's 9:00, then I open the repo at my desk",
  resumeNote: null,
  goalId: null,
  estMin: 50,
  actualMin: null,
  rescheduleCount: 0,
  updatedAt: "2026-10-22T00:00:00.000Z",
  deletedAt: null,
  ...over,
});

const habit = (id: string, behaviour: string): Habit => ({ id, anchor: null, behaviour, minimum: null, frequency: "daily", areaId: null, active: true, updatedAt: "", deletedAt: null });
const habits: HabitToday[] = [
  { habit: habit("h1", "Kana 10 min"), done: true },
  { habit: habit("h2", "Walk after lunch"), done: false },
];

/**
 * Design page (docs/06 v2.0): every phone component from docs/10 §5 and docs/11 with the shared
 * sample data from core, in the current theme, with a light / dark switch. Development builds only
 * (linked from Settings when __DEV__). Nothing here reads or writes the store.
 */
export default function DesignPage() {
  const s = useStyles(makeStyles);
  const { c, dark } = useTheme();
  const [pill, setPill] = useState<"day" | "week" | "month">("week");
  const [status, setStatus] = useState<MissionStatus>("open");
  const [toast, setToast] = useState(0);
  const areaParts = S.areas.map((a) => ({ key: a.key, label: a.label, minutes: a.minutes, fill: AREA_COLORS[a.color].fill, deep: AREA_COLORS[a.color].deep }));

  return (
    <Screen sheet>
      <SheetHeader title="Design" subtitle="Sample data · nothing is saved" onClose={() => router.back()} />
      <SegmentedPills
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        value={dark ? "dark" : "light"}
        onChange={(v) => void setThemePref(v)}
        accessibilityLabel="Theme"
        stretch
      />

      <Group title="Buttons and circles">
        <View style={s.row}>
          <IconCircle icon="capture" variant="primary" onPress={() => undefined} accessibilityLabel="Capture" />
          <IconCircle icon="reminders" variant="soft" onPress={() => undefined} accessibilityLabel="Reminders" />
          <IconCircle icon="search" onPress={() => undefined} accessibilityLabel="Search" />
          <IconCircle icon="done" variant="accent" />
        </View>
        <BigButton label="Primary" onPress={() => setToast((n) => n + 1)} />
        <BigButton label="Accent · Start" variant="accent" icon="start" onPress={() => undefined} />
        <BigButton label="Secondary" variant="secondary" onPress={() => undefined} />
        <BigButton label="Quiet link" variant="quiet" onPress={() => undefined} />
        <SegmentedPills options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} value={pill} onChange={setPill} accessibilityLabel="Range" stretch />
        <TextField label="Text field" placeholder="Type here" />
        <View style={s.toast}>
          <Toast message="Saved" token={toast} />
        </View>
        <View style={s.row}>
          {(["today", "calendar", "focus", "settings", "stuck", "recharge", "habit", "locked"] as const).map((n) => (
            <Icon key={n} name={n} color={c.ink} />
          ))}
        </View>
      </Group>

      <Group title="Missions">
        <P1HeroCard mission={mission("P1", "Terraform: OCI network module")} onStart={() => undefined} status="Plan locked">
          <StatusChips status={status} onChange={setStatus} missionTitle="P1" />
        </P1HeroCard>
        <MissionCard mission={mission("P2", "DSA: 2 sliding-window problems", { estMin: 45 })} onStatus={() => undefined} onStuck={() => undefined} onFocus={() => undefined} />
        <MissionCard mission={mission("P3", "JLPT N5: 20 kana cards", { estMin: 20, status: "done" })} onStatus={() => undefined} />
        <MissionCard mission={mission("P4", "Read one chapter", { estMin: null, status: "missed" })} onStatus={() => undefined} />
        <MissionCard mission={mission("side", "Fix the bike light", { estMin: null })} onStatus={() => undefined} />
        <HabitStrip items={habits} onToggle={() => undefined} />
      </Group>

      <Group title="Calendar">
        <WeekStrip days={S.weekDays} today={S.today} onSelect={() => undefined} />
        <Card>
          <MonthCalendar month={S.month} days={S.monthDays} onSelect={() => undefined} />
        </Card>
        <DayLegend />
        <View style={s.row}>
          {(["Strong", "Solid", "Light", "Missed", "Rest", "WriteOff", "Today", "Future"] as const).map((st, i) => (
            <DayCircle key={st} date={`2026-10-${String(10 + i)}`} state={st} hasNote={i % 2 === 0} />
          ))}
        </View>
      </Group>

      <Group title="Scoreboard">
        <Scoreboard boxes={S.boxes} keys={["days_shown_up", "today_score", "avg_7d", "p1_hit_rate"]} />
        <MetricCard box={S.boxes[2]} tone="surface" onOpen={() => undefined} />
      </Group>

      <Group title="Charts">
        <HatchedStackBar days={S.weekDays} today={S.today} summary={S.weekSummary} />
        <StripeTrend points={S.screen14} today={S.today} label="Screen minutes, last 14 days" />
        <Sparkline points={S.scores30} avg7={S.avg7} label="Final score, last 30 days" />
        <SegmentGauge marks={S.weekMarks} pct={S.cycle.pct} word={S.cycle.word} label="Cycle gauge sample" />
        <View style={s.row}>
          {S.goals.map((g) => (
            <RingProgress key={g.name} pct={g.pct} color={AREA_COLORS[g.color].deep} accessibilityLabel={`${g.name} ${g.pct}%`} />
          ))}
        </View>
        <View style={s.center}>
          <FocusRing progress={0.62} size={200} accessibilityLabel="Focus ring sample">
            <Text style={s.clock}>18:40</Text>
          </FocusRing>
        </View>
        <AreaSplit parts={areaParts} label="Focus by area sample" />
        <BlockBarChart
          columns={["W40", "W41", "W42", "W43"].map((w, i) => ({ label: w, values: Object.fromEntries(S.areas.map((a) => [a.key, a.minutes * (0.5 + i * 0.2)])) }))}
          series={S.areas.map((a) => ({ key: a.key, label: a.label, fill: AREA_COLORS[a.color].fill, deep: AREA_COLORS[a.color].deep }))}
          unit={30}
          unitLabel="30 min"
          label="Focus minutes by area per week, sample"
        />
        <PillBar
          parts={[
            { label: "Uncertainty", value: S.stuck.uncertainty, fill: c.area.sky, deep: AREA_COLORS.sky.deep },
            { label: "Fear", value: S.stuck.fear, fill: c.lavender, deep: c.lavenderDeep },
            { label: "Inertia", value: S.stuck.inertia, fill: c.lime, deep: c.limeDeep },
          ]}
          label="Stuck this week sample"
        />
        <HabitHeatGrid grid={S.habitGrid} />
        <CapacityBar plannedMin={S.capacity.plannedMin} freeMin={S.capacity.freeMin} scoring={DEFAULT_SCORING} />
      </Group>

      <Group title="Text">
        <Kural n={619} />
      </Group>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <Card tone="surface">
      <Text style={s.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    heading: { ...f(600, 17, 24), color: c.ink },
    row: { flexDirection: "row", flexWrap: "wrap", gap: space(1), alignItems: "center" },
    center: { alignItems: "center" },
    clock: { ...f(600, 40), color: c.ink, fontVariant: ["tabular-nums"] },
    toast: { alignItems: "center", minHeight: 40 },
  });
