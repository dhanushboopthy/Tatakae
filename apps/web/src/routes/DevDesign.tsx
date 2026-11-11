import { useState, type ReactNode } from "react";
import { DEFAULT_SCORING, DESIGN_SAMPLES as S, type Mission, type MissionStatus } from "@tatakae/core";
import { AREA_COLORS } from "../lib/colors";
import { PageHeader } from "../components/PageHeader";
import { IconCircle } from "../components/IconCircle";
import { BellIcon, CheckIcon, PlusIcon, SearchIcon } from "../components/icons";
import { SegmentedPills } from "../components/SegmentedPills";
import { StatusChips } from "../components/StatusChips";
import { MissionCard } from "../components/MissionCard";
import { DayCircle, DayLegend } from "../components/DayCircle";
import { WeekStrip } from "../components/WeekStrip";
import { MonthCalendar } from "../components/MonthCalendar";
import { MetricCard } from "../components/MetricCard";
import { HatchedStackBar } from "../components/HatchedStackBar";
import { StripeTrend } from "../components/StripeTrend";
import { Sparkline } from "../components/Sparkline";
import { SegmentGauge } from "../components/SegmentGauge";
import { RingProgress } from "../components/RingProgress";
import { FocusRing } from "../components/FocusRing";
import { AreaBlock } from "../components/AreaBlock";
import { BlockBarChart } from "../components/BlockBarChart";
import { PillBar } from "../components/PillBar";
import { HabitHeatGrid } from "../components/HabitHeatGrid";
import { CapacityBar } from "../components/CapacityBar";
import { Kural } from "../components/Kural";

// Design page (docs/06 v2.0): every component from docs/10 §5 and docs/11 with the shared sample data
// from core (the phone has the same page). Development builds only (the route is not registered in
// production). Mission cards are inert so nothing here can write to the store.

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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4" aria-labelledby={`dd-${title}`}>
      <h2 id={`dd-${title}`} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DevDesign() {
  const [pill, setPill] = useState<"day" | "week" | "month">("week");
  const [status, setStatus] = useState<MissionStatus>("open");
  const series = S.areas.map((a) => ({ key: a.key, label: a.label, fill: AREA_COLORS[a.color].fill, deep: AREA_COLORS[a.color].deep }));

  return (
    <div className="page">
      <PageHeader eyebrow="Sample data · nothing is saved" title="Design" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Group title="Buttons and circles">
          <div className="flex flex-wrap gap-2">
            <IconCircle variant="primary">
              <PlusIcon />
            </IconCircle>
            <IconCircle variant="soft">
              <BellIcon />
            </IconCircle>
            <IconCircle>
              <SearchIcon />
            </IconCircle>
            <IconCircle variant="lime">
              <CheckIcon />
            </IconCircle>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary">
              Primary
            </button>
            <button type="button" className="btn-accent">
              Accent
            </button>
            <button type="button" className="btn-secondary">
              Secondary
            </button>
            <button type="button" className="btn-ghost">
              Ghost
            </button>
          </div>
          <SegmentedPills
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
            value={pill}
            onChange={setPill}
            label="Range"
          />
          <StatusChips value={status} onChange={setStatus} label="Sample mission" />
        </Group>

        <Group title="Missions">
          <div inert className="space-y-3">
            <MissionCard mission={mission("P1", "Terraform: OCI network module")} forged />
            <MissionCard mission={mission("P2", "DSA: 2 sliding-window problems", { estMin: 45 })} forged={false} />
            <MissionCard mission={mission("P3", "JLPT N5: 20 kana cards", { estMin: 20, status: "done" })} forged={false} compact />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {S.areas.map((a) => (
              <AreaBlock key={a.key} tag={a.label} title={`${a.label} block`} time="09:00–10:30" fill={AREA_COLORS[a.color].fill} deep={AREA_COLORS[a.color].deep} />
            ))}
          </div>
        </Group>

        <Group title="Calendar">
          <WeekStrip days={S.weekDays} onSelect={() => undefined} />
          <MonthCalendar month={S.month} days={S.monthDays} onSelect={() => undefined} />
          <DayLegend />
          <div className="flex flex-wrap gap-2">
            {(["Strong", "Solid", "Light", "Missed", "Rest", "WriteOff", "Today", "Future"] as const).map((st, i) => (
              <DayCircle key={st} date={`2026-10-${String(10 + i)}`} state={st} hasNote={i % 2 === 0} />
            ))}
          </div>
        </Group>

        <Group title="Scoreboard">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {S.boxes.map((b, i) => (
              <MetricCard key={b.key} box={b} bar={i % 2 === 1 ? "lavender" : "lime"} />
            ))}
          </div>
        </Group>

        <Group title="Week charts">
          <HatchedStackBar days={S.weekDays} today={S.today} summary={S.weekSummary} />
          <StripeTrend points={S.screen14} today={S.today} label="Screen minutes, last 14 days" />
          <Sparkline points={S.scores30} avg7={S.avg7} label="Final score, last 30 days" />
          <PillBar
            parts={[
              { label: "Uncertainty", value: S.stuck.uncertainty, fill: AREA_COLORS.sky.fill, deep: AREA_COLORS.sky.deep },
              { label: "Fear", value: S.stuck.fear, fill: AREA_COLORS["lavender-soft"].fill, deep: AREA_COLORS["lavender-soft"].deep },
              { label: "Inertia", value: S.stuck.inertia, fill: AREA_COLORS["lime-soft"].fill, deep: AREA_COLORS["lime-soft"].deep },
            ]}
            label="Stuck this week sample"
          />
        </Group>

        <Group title="Cycle and month charts">
          <SegmentGauge marks={S.weekMarks} pct={S.cycle.pct} word={S.cycle.word} label="Cycle gauge sample" />
          <div className="flex flex-wrap gap-4">
            {S.goals.map((g) => (
              <RingProgress key={g.name} pct={g.pct} color={AREA_COLORS[g.color].deep} label={`${g.name} ${g.pct}%`} caption={g.name} />
            ))}
          </div>
          <BlockBarChart
            columns={["W40", "W41", "W42", "W43"].map((w, i) => ({ label: w, values: Object.fromEntries(S.areas.map((a) => [a.key, a.minutes * (0.5 + i * 0.2)])) }))}
            series={series}
            unit={30}
            unitLabel="30 min"
            label="Focus minutes by area per week, sample"
          />
          <HabitHeatGrid grid={S.habitGrid} />
        </Group>

        <Group title="Focus and capacity">
          <div className="flex justify-center">
            <FocusRing fraction={0.62} size={220}>
              <span className="tnum text-hero-sm">18:40</span>
            </FocusRing>
          </div>
          <CapacityBar plannedMin={S.capacity.plannedMin} freeMin={S.capacity.freeMin} scoring={DEFAULT_SCORING} />
        </Group>

        <Group title="Text">
          <Kural n={619} />
        </Group>
      </div>
    </div>
  );
}
