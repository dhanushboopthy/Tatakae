import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { addDays, isoWeek, isoWeekRange, monthOf, monthRange, type ISODate } from "@tatakae/core";
import { useAreas, useCalendarMonth, useMonthStats, useScoreboard, useSeries, useToday, useWeekStats } from "../../src/lib/hooks";
import { areaColor, UNASSIGNED } from "../../src/lib/colors";
import { monthTitle, shortDate } from "../../src/lib/format";
import { MonthCalendar } from "../../src/components/MonthCalendar";
import { DayLegend } from "../../src/components/DayCircle";
import { Scoreboard } from "../../src/components/Scoreboard";
import { HatchedStackBar } from "../../src/components/HatchedStackBar";
import { StripeTrend } from "../../src/components/StripeTrend";
import { AreaSplit } from "../../src/components/BlockBarChart";
import { SegmentedPills } from "../../src/components/SegmentedPills";
import { IconCircle } from "../../src/components/IconCircle";
import { Icon } from "../../src/components/Icon";
import { Card, Screen, ScreenHeader } from "../../src/components/Screen";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../../src/lib/theme";

type Mode = "week" | "month";
const MODES = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

/** "YYYY-MM" one month before / after. */
function shiftMonth(yyyymm: string, n: number): string {
  const { start, end } = monthRange(yyyymm);
  return monthOf(n < 0 ? addDays(start, -1) : addDays(end, 1));
}

/**
 * Calendar tab (docs/11 §1/§4, mockups Phone-Calendar and Phone-Week). Week: hatched points per day,
 * screen minutes for 14 days, focus by area, habits. Month: day circles, legend, summary and four
 * scoreboard boxes. Tap a day → its sheet. All computed on the phone, so it works offline.
 */
export default function Calendar() {
  const s = useStyles(makeStyles);
  const [mode, setMode] = useState<Mode>("week");
  return (
    <Screen tab>
      <ScreenHeader
        title="Calendar"
        right={
          <>
            <IconCircle icon="cycle" variant="soft" onPress={() => router.push("/cycle")} accessibilityLabel="Cycle" accessibilityHint="The 12-week cycle gauge and goals" />
            <IconCircle icon="notes" variant="soft" onPress={() => router.push("/notes")} accessibilityLabel="Notes" accessibilityHint="Search and read your notes" />
            <IconCircle icon="capture" variant="primary" onPress={() => router.push("/capture")} accessibilityLabel="Capture" />
          </>
        }
      />
      <SegmentedPills options={MODES} value={mode} onChange={setMode} accessibilityLabel="View" stretch />
      {mode === "week" ? <WeekView /> : <MonthView />}
      <View style={s.spacer} />
    </Screen>
  );
}

function WeekView() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const today = useToday();
  const [anchor, setAnchor] = useState<ISODate>(today);
  const week = isoWeek(anchor);
  const { start, end } = isoWeekRange(week.year, week.week);
  const stats = useWeekStats(week);
  const screen = useSeries("screen_min", 14);
  const { data: areas = [] } = useAreas();
  const current = today >= start && today <= end;

  const parts = (stats.data?.areaMinutes ?? []).map((a, i) => {
    const area = areas.find((x) => x.id === a.areaId) ?? null;
    const col = area ? areaColor(area, areas.indexOf(area)) : UNASSIGNED;
    return { key: a.areaId ?? `none-${i}`, label: area?.name ?? "No area", minutes: a.minutes, fill: col.fill, deep: col.deep };
  });

  return (
    <>
      <View style={s.navRow}>
        <IconCircle icon="back" size={44} onPress={() => setAnchor(addDays(start, -7))} accessibilityLabel="Previous week" />
        <Text style={s.navTitle} accessibilityRole="header">
          {current ? "This week" : `${shortDate(start)} – ${shortDate(end)}`}
        </Text>
        <IconCircle icon="forward" size={44} onPress={() => setAnchor(addDays(start, 7))} accessibilityLabel="Next week" disabled={current} />
      </View>
      {!current ? <ThisPill label="This week" onPress={() => setAnchor(today)} /> : null}

      {stats.data ? <HatchedStackBar days={stats.data.days} today={today} summary={stats.data.summary} /> : null}

      {screen.data ? (
        <Card>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Screen minutes · 14 d</Text>
            <Text style={s.big}>
              {screen.data.average ?? "—"}
              <Text style={s.unit}> avg</Text>
            </Text>
          </View>
          <StripeTrend points={screen.data.points} today={today} label={screen.data.summary} />
          <Text style={s.small}>Free under 120. Dashed line = 120.</Text>
        </Card>
      ) : null}

      {stats.data ? (
        <Card>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Focus by area</Text>
            <Text style={s.big}>
              {stats.data.focusMinutes}
              <Text style={s.unit}> min</Text>
            </Text>
          </View>
          <AreaSplit parts={parts} label={parts.map((p) => `${p.label} ${p.minutes} minutes`).join(", ") || "No focus blocks this week"} />
        </Card>
      ) : null}

      {stats.data ? (
        <Card>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Habits this week</Text>
            <Text style={s.big}>{stats.data.habitsPct == null ? "—" : `${stats.data.habitsPct}%`}</Text>
          </View>
          <Text style={s.small}>Tracked, not scored.</Text>
        </Card>
      ) : null}

      <Pressable onPress={() => router.push("/cycle")} accessibilityRole="button" style={({ pressed }) => [s.cycleLink, pressed && pressedStyle]}>
        <Icon name="cycle" color={c.onFill} />
        <Text style={s.cycleText}>Cycle gauge and goals</Text>
        <Icon name="forward" color={c.onFill} />
      </Pressable>
    </>
  );
}

function MonthView() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const [month, setMonth] = useState(() => monthOf(today));
  const days = useCalendarMonth(month);
  const stats = useMonthStats(month);
  const board = useScoreboard();
  const current = month === monthOf(today);
  const future = month > monthOf(today);
  const open = (d: ISODate) => router.push({ pathname: "/day/[date]", params: { date: d } });

  return (
    <>
      <View style={s.card}>
        <View style={s.navRow}>
          <IconCircle icon="back" size={44} variant="white" onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityLabel="Previous month" />
          <Text style={s.navTitle} accessibilityRole="header">
            {monthTitle(month)}
          </Text>
          <IconCircle icon="forward" size={44} variant="white" onPress={() => setMonth((m) => shiftMonth(m, 1))} accessibilityLabel="Next month" disabled={future} />
        </View>
        {!current ? <ThisPill label="This month" onPress={() => setMonth(monthOf(today))} /> : null}
        {days.data ? <MonthCalendar month={month} days={days.data} onSelect={open} /> : <View style={s.placeholder} />}
      </View>
      <DayLegend />
      {stats.data?.summary ? <Text style={s.small}>{stats.data.summary}</Text> : null}
      {board.data ? <Scoreboard boxes={board.data} keys={["today_score", "days_shown_up", "avg_7d", "p1_hit_rate"]} /> : null}
    </>
  );
}

function ThisPill({ label, onPress }: { label: string; onPress: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.thisPill, pressed && pressedStyle]}>
      <Text style={s.thisText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface2, borderRadius: radius.card, padding: space(1.75), gap: space(1) },
    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navTitle: { ...f(600, 16, 22), color: c.ink },
    thisPill: { alignSelf: "center", minHeight: minTarget, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.lime },
    thisText: { ...f(600, 13), color: c.onFill },
    placeholder: { height: 280 },
    small: { ...f(500, 13, 18), color: c.ink2 },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    cardTitle: { ...f(600, 13, 18), color: c.ink },
    big: { ...f(600, 22, 28), color: c.ink, fontVariant: ["tabular-nums"] },
    unit: { ...f(500, 12), color: c.ink2 },
    cycleLink: { minHeight: minTarget + 8, flexDirection: "row", alignItems: "center", gap: space(1.5), paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.lavenderSoft },
    cycleText: { ...f(600, 15), color: c.onFill, flex: 1 },
    spacer: { height: space(1) },
  });
