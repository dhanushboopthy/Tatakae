import { StyleSheet, Text, View } from "react-native";
import type { CalendarDay, ISODate } from "@tatakae/core";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { weekdayInitial } from "../lib/format";
import { DayCircle } from "./DayCircle";

/** Week strip on the Today header (docs/11 §4, ref 02): 7 day circles with weekday letters; today charcoal. */
export function WeekStrip(props: { days: readonly CalendarDay[]; today: ISODate; selected?: ISODate; onSelect?: (date: ISODate) => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.row} accessibilityLabel="This week">
      {props.days.map((d) => (
        <View key={d.date} style={s.col}>
          <Text style={[s.letter, d.date === props.today && s.letterToday]} accessibilityElementsHidden importantForAccessibility="no">
            {weekdayInitial(d.date)}
          </Text>
          <DayCircle
            date={d.date}
            state={d.state}
            hasNote={d.hasNote}
            final={d.final}
            selected={props.selected === d.date && d.date !== props.today}
            onPress={props.onSelect ? () => props.onSelect?.(d.date) : undefined}
          />
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "space-between" },
    col: { alignItems: "center", gap: space(0.25) },
    letter: { ...f(600, 12, 16), color: c.ink2 },
    letterToday: { ...f(700, 12, 16), color: c.ink },
  });
