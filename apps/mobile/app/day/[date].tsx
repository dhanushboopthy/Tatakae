import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { isIsoDate, focusMinutes, type ISODate, type MetricBox } from "@tatakae/core";
import { useCalendarDay, useDay, useFocusSessionsOn, useHabits, useToday } from "../../src/lib/hooks";
import { STATE_LABEL } from "../../src/lib/colors";
import { longDate } from "../../src/lib/format";
import { SLOT_LABEL } from "../../src/components/MissionCard";
import { STATUS_GLYPH, STATUS_LABEL } from "../../src/components/StatusChips";
import { MetricCard } from "../../src/components/MetricCard";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { f, space } from "../../src/theme";
import { useStyles, type Theme } from "../../src/lib/theme";

/**
 * Day sheet (docs/11 §4): score box, missions with their statuses, habits, screen minutes, small win
 * and the three answers, focus blocks. Read-only: today is changed on Today, plans on the laptop.
 */
export default function DaySheet() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const date: ISODate = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
  return <DayBody date={date} today={today} />;
}

function DayBody({ date, today }: { date: ISODate; today: ISODate }) {
  const s = useStyles(makeStyles);
  const { data: view } = useDay(date);
  const { data: cal } = useCalendarDay(date);
  const { data: habits = [] } = useHabits(date);
  const { data: focus = [] } = useFocusSessionsOn(date);
  const day = view?.day ?? null;
  const missions = view?.missions ?? [];
  const future = date > today;

  const box: MetricBox | null = cal
    ? {
        key: "today_score",
        label: date === today ? "Today's score" : "Score",
        value: cal.final,
        unit: "",
        delta: null,
        target: 100,
        progress: cal.final,
        context: cal.final != null ? STATE_LABEL[cal.state] : date === today ? "Shown after shutdown" : STATE_LABEL[cal.state],
      }
    : null;

  const answers: [string, string | null][] = [
    ["Small win", day?.smallWin ?? null],
    ["Did I do P1?", day?.qP1 ?? null],
    ["What made me drift?", day?.qDrift ?? null],
    ["What did I practise?", day?.qPractised ?? null],
  ];
  const focusTotal = focus.reduce((n, fs) => n + focusMinutes(fs), 0);

  return (
    <Screen sheet>
      <SheetHeader title={longDate(date)} subtitle={future ? "Planned on the laptop" : day?.kind === "rest" ? "Rest day" : day?.kind === "write_off" ? "Written off" : undefined} onClose={() => router.back()} />

      {box && !future ? <MetricCard box={box} tone="surface" /> : null}

      <Card tone="surface">
        <Text style={s.heading}>Missions</Text>
        {missions.length === 0 ? <Text style={s.small}>{future ? "Nothing planned yet." : "Nothing was planned."}</Text> : null}
        {missions.map((m) => (
          <View key={m.id} style={s.row}>
            <Text style={s.slot}>{SLOT_LABEL[m.slot]}</Text>
            <Text style={[s.title, (m.status === "missed" || m.status === "rescheduled") && s.grey]} numberOfLines={2}>
              {m.title}
            </Text>
            <Text style={s.status}>
              {STATUS_GLYPH[m.status]} {STATUS_LABEL[m.status]}
            </Text>
          </View>
        ))}
      </Card>

      {!future ? (
        <Card tone="surface">
          <Text style={s.heading}>Habits</Text>
          {habits.length === 0 ? <Text style={s.small}>No habits set up.</Text> : null}
          <View style={s.pills}>
            {habits.map(({ habit, done }) => (
              <View key={habit.id} style={[s.pill, done && s.pillDone]} accessible accessibilityLabel={`${habit.behaviour}: ${done ? "done" : "not done"}`}>
                <Text style={[s.pillText, done && s.pillTextDone]}>
                  {done ? "✓" : "○"} {habit.behaviour}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.small}>Screen minutes: {day?.screenMin != null ? `${day.screenMin} min` : "—"}</Text>
        </Card>
      ) : null}

      {!future && answers.some(([, v]) => v) ? (
        <Card tone="surface">
          {answers
            .filter(([, v]) => v)
            .map(([q, v]) => (
              <View key={q} style={s.answer}>
                <Text style={s.slot}>{q}</Text>
                <Text style={s.body}>{v}</Text>
              </View>
            ))}
        </Card>
      ) : null}

      {focus.length > 0 ? (
        <Card tone="surface">
          <Text style={s.heading}>Focus · {focusTotal} min</Text>
          {focus.map((fs) => {
            const m = missions.find((x) => x.id === fs.missionId);
            return (
              <View key={fs.id} style={s.focusRow}>
                <Text style={s.body} numberOfLines={1}>
                  {m?.title ?? "Focus block"}
                </Text>
                <Text style={s.small}>
                  {focusMinutes(fs)} of {fs.plannedMin} min{fs.completed ? " · full block" : ""}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    heading: { ...f(600, 16, 22), color: c.ink },
    body: { ...f(400, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    slot: { ...f(600, 12, 16), color: c.ink2 },
    row: { gap: 2, paddingVertical: space(1), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    title: { ...f(600, 16, 22), color: c.ink },
    grey: { color: c.ink2 },
    status: { ...f(600, 13, 18), color: c.ink2 },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: space(0.75) },
    pill: { borderRadius: 999, paddingHorizontal: space(1.5), paddingVertical: 6, backgroundColor: c.surface2 },
    pillDone: { backgroundColor: c.lime },
    pillText: { ...f(600, 13), color: c.ink },
    pillTextDone: { color: c.onFill },
    answer: { gap: 2 },
    focusRow: { gap: 2, paddingVertical: space(0.75), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  });
