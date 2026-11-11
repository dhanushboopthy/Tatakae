import { ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { HabitCell, HabitGrid } from "@tatakae/core";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { shortDate } from "../lib/format";

/** Habit heat grid (docs/11 C7): rows = habits, columns = days; lime done, surface-2 not done, hollow rest. */
export function HabitHeatGrid({ grid }: { grid: HabitGrid }) {
  const s = useStyles(makeStyles);
  if (grid.rows.length === 0) return <Text style={s.small}>No active habits.</Text>;
  const first = grid.dates[0];
  const last = grid.dates.at(-1);
  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.rows}>
          {grid.rows.map((row) => (
            <View
              key={row.habitId}
              style={s.row}
              accessible
              accessibilityLabel={`${row.behaviour}: ${row.pct == null ? "no checks yet" : `${row.pct}% done`} from ${first ? shortDate(first) : ""} to ${last ? shortDate(last) : ""}`}
            >
              <View style={s.name}>
                <Text style={s.nameText} numberOfLines={1}>
                  {row.behaviour}
                </Text>
                <Text style={s.small}>{row.pct == null ? "—" : `${row.pct}%`}</Text>
              </View>
              {row.cells.map((cell, i) => (
                <View key={grid.dates[i] ?? i} style={[s.cell, s[cell]]} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {(
          [
            ["done", "Done"],
            ["not", "Not done"],
            ["rest", "Rest day"],
          ] as const
        ).map(([cell, label]) => (
          <View key={cell} style={s.legendItem}>
            <View style={[s.cell, s[cell]]} />
            <Text style={s.small}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    rows: { gap: 3 },
    row: { flexDirection: "row", alignItems: "center", gap: 3 },
    name: { width: 104, paddingRight: space(1) },
    nameText: { ...f(500, 13, 18), color: c.ink },
    small: { ...f(500, 12, 16), color: c.ink2 },
    cell: { width: 12, height: 12, borderRadius: 3 },
    legend: { flexDirection: "row", gap: space(2) },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    ...({
      done: { backgroundColor: c.lime, borderWidth: 1.5, borderColor: c.limeDeep },
      not: { backgroundColor: c.surface2 },
      rest: { borderWidth: 1.5, borderColor: c.missed },
      none: {},
    } satisfies Record<HabitCell, ViewStyle>),
  });
