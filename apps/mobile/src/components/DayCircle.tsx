import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { CalendarState, ISODate } from "@tatakae/core";
import { f, minTarget, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
import { STATE_LABEL } from "../lib/colors";
import { longDate } from "../lib/format";
import { tapLight } from "../haptics";

/**
 * Calendar day cell (docs/11 §4): Strong = lime, Solid = lavender, Light = lime-soft + lime-deep ring,
 * Missed = surface-2 + grey dash, Rest = hollow ring, write-off = dashed ring, Today = charcoal,
 * Future = plain number. A dot under the circle marks a reflection / small win.
 */
export function DayCircle(props: {
  date: ISODate;
  state: CalendarState;
  hasNote?: boolean;
  final?: number | null;
  size?: number;
  selected?: boolean;
  /** Inside a surface-2 card: grey cells (missed, unplanned) switch to white so they still show. */
  onCard?: boolean;
  onPress?: () => void;
}) {
  const s = useStyles(makeStyles);
  const size = props.size ?? 40;
  const day = Number(props.date.slice(8, 10));
  const label = `${longDate(props.date)}: ${STATE_LABEL[props.state]}${props.final != null ? `, score ${props.final}` : ""}${
    props.hasNote ? ", has a reflection" : ""
  }`;
  const look = s[props.state];
  const ink = s[`${props.state}Text` as const];
  const circle = (
    <View
      style={[
        s.circle,
        { width: size, height: size, borderRadius: size / 2 },
        look,
        props.onCard && (props.state === "Missed" || props.state === "Unplanned") && s.onCard,
        props.selected && s.selected,
      ]}
    >
      <Text style={[s.num, ink]}>{day}</Text>
      {props.state === "Missed" ? <View style={s.dash} /> : null}
    </View>
  );
  const dot = <View style={[s.dot, props.hasNote && s.dotOn]} />;
  if (!props.onPress) {
    return (
      <View style={s.cell} accessible accessibilityRole="image" accessibilityLabel={label}>
        {circle}
        {dot}
      </View>
    );
  }
  const onPress = props.onPress;
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: props.selected === true }}
      style={({ pressed }) => [s.cell, s.target, pressed && pressedStyle]}
    >
      {circle}
      {dot}
    </Pressable>
  );
}

type States = Record<CalendarState, ViewStyle> & Record<`${CalendarState}Text`, TextStyle>;

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    cell: { alignItems: "center" },
    target: { minWidth: minTarget, minHeight: minTarget, justifyContent: "center" },
    circle: { alignItems: "center", justifyContent: "center" },
    selected: { borderWidth: 2, borderColor: c.ink },
    onCard: { backgroundColor: c.surface },
    num: { ...f(600, 14), fontVariant: ["tabular-nums"] },
    dash: { position: "absolute", bottom: 7, width: 12, height: 2, borderRadius: 1, backgroundColor: c.missed },
    dot: { marginTop: space(0.5), width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
    dotOn: { backgroundColor: c.ink },
    ...({
      Strong: { backgroundColor: c.lime },
      Solid: { backgroundColor: c.lavender },
      Light: { backgroundColor: c.limeSoft, borderWidth: 2, borderColor: c.limeDeep },
      Missed: { backgroundColor: c.surface2 },
      Rest: { borderWidth: 2, borderColor: c.missed },
      WriteOff: { borderWidth: 2, borderColor: c.missed, borderStyle: "dashed" },
      Today: { backgroundColor: c.hero },
      Future: {},
      Unplanned: { backgroundColor: c.surface2 },
      StrongText: { color: c.onFill },
      SolidText: { color: c.onFill },
      LightText: { color: c.onFill },
      MissedText: { color: c.ink },
      RestText: { color: c.ink },
      WriteOffText: { color: c.ink },
      TodayText: { color: c.onHero },
      FutureText: { ...f(500, 14), color: c.ink2 },
      UnplannedText: { ...f(500, 14), color: c.ink2 },
    } satisfies States),
  });

/** Legend row for day circles (shape + colour + label). */
export function DayLegend() {
  const s = useStyles(makeLegendStyles);
  const items: [CalendarState, string][] = [
    ["Strong", "Strong ≥ 80"],
    ["Solid", "Solid 50–79"],
    ["Light", "Light"],
    ["Missed", "Missed"],
    ["Rest", "Rest"],
    ["Today", "Today"],
  ];
  const cs = useStyles(makeStyles);
  return (
    <View style={s.row} accessibilityLabel="Legend">
      {items.map(([state, text]) => (
        <View key={state} style={s.item}>
          <View style={[s.swatch, cs[state], state === "Light" || state === "Rest" ? s.thin : null]} />
          <Text style={s.text}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const makeLegendStyles = ({ c }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", columnGap: space(2), rowGap: space(1) },
    item: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 14, height: 14, borderRadius: 7 },
    thin: { borderWidth: 1.5 },
    text: { ...f(500, 13, 18), color: c.ink2 },
  });
