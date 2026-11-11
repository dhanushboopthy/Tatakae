import { StyleSheet, Text, View } from "react-native";
import { addDays, type ISODate } from "@tatakae/core";
import { longDate } from "../lib/format";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { PillButton, Stepper } from "./fitnessUi";

/**
 * Pick a date without a calendar: a day at a time with − / +, a week at a time with the pills. `max` and
 * `min` stop it at the edges. (No date-picker dependency, so it works in every build.)
 */
export function DateStepper(props: { value: ISODate; onChange: (d: ISODate) => void; label: string; min?: ISODate; max?: ISODate }) {
  const s = useStyles(makeStyles);
  const clamp = (d: ISODate): ISODate => (props.max && d > props.max ? props.max : props.min && d < props.min ? props.min : d);
  const move = (days: number) => props.onChange(clamp(addDays(props.value, days)));
  const atMax = props.max != null && props.value >= props.max;
  const atMin = props.min != null && props.value <= props.min;
  return (
    <View style={s.wrap} accessible={false}>
      <Text style={s.label}>{props.label}</Text>
      <Stepper
        minusLabel={`${props.label}: one day earlier`}
        plusLabel={`${props.label}: one day later`}
        onMinus={() => move(-1)}
        onPlus={() => move(1)}
        value={<Text style={s.value}>{longDate(props.value)}</Text>}
      />
      <View style={s.row}>
        <PillButton label="− 7 days" tone="neutral" disabled={atMin} onPress={() => move(-7)} accessibilityLabel={`${props.label}: one week earlier`} flex />
        <PillButton label="+ 7 days" tone="neutral" disabled={atMax} onPress={() => move(7)} accessibilityLabel={`${props.label}: one week later`} flex />
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    label: { ...f(600, 13, 18), color: c.ink2 },
    value: { ...f(600, 18, 24), color: c.ink, minWidth: 160, textAlign: "center" },
    row: { flexDirection: "row", gap: space(1) },
  });
