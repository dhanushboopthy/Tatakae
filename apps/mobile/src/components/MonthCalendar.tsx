import { StyleSheet, Text, View } from "react-native";
import { monthGrid, type CalendarDay, type ISODate } from "@tatakae/core";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { DayCircle } from "./DayCircle";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Month grid of day circles (docs/11 §4), Monday first. Tap a day to open its sheet. */
export function MonthCalendar(props: {
  month: string; // "YYYY-MM"
  days: readonly CalendarDay[];
  selected?: ISODate | null;
  onSelect?: (date: ISODate) => void;
}) {
  const s = useStyles(makeStyles);
  const grid = monthGrid(props.month, props.days);
  return (
    <View style={s.grid}>
      <View style={s.row}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={s.head} accessibilityLabel={WEEKDAY_NAMES[i]}>
            {w}
          </Text>
        ))}
      </View>
      {grid.map((week, i) => (
        <View key={i} style={s.row}>
          {week.map((d, j) => (
            <View key={d ? d.date : `pad-${i}-${j}`} style={s.cell}>
              {d ? (
                <DayCircle
                  date={d.date}
                  state={d.state}
                  hasNote={d.hasNote}
                  final={d.final}
                  size={38}
                  onCard
                  selected={props.selected === d.date}
                  onPress={props.onSelect ? () => props.onSelect?.(d.date) : undefined}
                />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    grid: { gap: space(0.5) },
    row: { flexDirection: "row" },
    cell: { flex: 1, alignItems: "center" },
    head: { flex: 1, textAlign: "center", ...f(600, 12, 16), color: c.ink2, paddingBottom: space(0.5) },
  });
