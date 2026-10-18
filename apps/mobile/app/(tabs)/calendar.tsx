import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { monthOf, monthRange, addDays, type ISODate } from "@tatakae/core";
import { useCalendarMonth, useMonthStats, useScoreboard, useToday } from "../../src/lib/hooks";
import { monthTitle } from "../../src/lib/format";
import { MonthCalendar } from "../../src/components/MonthCalendar";
import { DayLegend } from "../../src/components/DayCircle";
import { Scoreboard } from "../../src/components/Scoreboard";
import { IconCircle } from "../../src/components/IconCircle";
import { Screen, ScreenHeader } from "../../src/components/Screen";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, type Theme } from "../../src/lib/theme";

/** "YYYY-MM" one month before / after. */
function shiftMonth(yyyymm: string, n: number): string {
  const { start, end } = monthRange(yyyymm);
  return monthOf(n < 0 ? addDays(start, -1) : addDays(end, 1));
}

/**
 * Calendar tab (docs/11 §4, mockup Phone-Calendar): month header with ‹ › and "This month", the month
 * of day circles with a legend and a one-line summary, then 4 scoreboard boxes. Tap a day → its sheet.
 * Everything is computed on the phone from the local copy, so it works offline.
 */
export default function Calendar() {
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
    <Screen tab>
      <ScreenHeader
        title="Calendar"
        right={<IconCircle icon="capture" variant="primary" onPress={() => router.push("/capture")} accessibilityLabel="Capture" />}
      />

      <View style={s.card}>
        <View style={s.monthRow}>
          <IconCircle icon="back" size={44} variant="white" onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityLabel="Previous month" />
          <Text style={s.month} accessibilityRole="header">
            {monthTitle(month)}
          </Text>
          <IconCircle
            icon="forward"
            size={44}
            variant="white"
            onPress={() => setMonth((m) => shiftMonth(m, 1))}
            accessibilityLabel="Next month"
            disabled={future}
          />
        </View>
        {!current ? (
          <Pressable onPress={() => setMonth(monthOf(today))} accessibilityRole="button" style={({ pressed }) => [s.thisMonth, pressed && pressedStyle]}>
            <Text style={s.thisMonthText}>This month</Text>
          </Pressable>
        ) : null}
        {days.data ? <MonthCalendar month={month} days={days.data} onSelect={open} /> : <View style={s.placeholder} />}
      </View>

      <DayLegend />
      {stats.data?.summary ? <Text style={s.summary}>{stats.data.summary}</Text> : null}

      {board.data ? <Scoreboard boxes={board.data} keys={["today_score", "days_shown_up", "avg_7d", "p1_hit_rate"]} /> : null}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface2, borderRadius: radius.card, padding: space(1.75), gap: space(1) },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    month: { ...f(600, 16, 22), color: c.ink },
    thisMonth: { alignSelf: "center", minHeight: minTarget, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.lime },
    thisMonthText: { ...f(600, 13), color: c.onFill },
    placeholder: { height: 280 },
    summary: { ...f(500, 14, 20), color: c.ink2 },
  });
