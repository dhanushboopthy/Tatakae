import { StyleSheet, Text, View } from "react-native";
import { KURALS, type KuralNumber } from "@tatakae/core";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";

/**
 * One Thirukkural (core/kural.ts) with a lime-deep rule at the left, like the website. The Tamil
 * lines use the system font (Plus Jakarta Sans has no Tamil glyphs). Never on Morning or a running timer.
 */
export function Kural({ n = 619, meaning = true }: { n?: KuralNumber; meaning?: boolean }) {
  const s = useStyles(makeStyles);
  const k = KURALS[n];
  return (
    <View style={s.wrap} accessible accessibilityLabel={`Thirukkural ${n}. ${k.meaning}`}>
      {k.lines.map((line) => (
        <Text key={line} style={s.line}>
          {line}
        </Text>
      ))}
      <Text style={s.caption}>திருக்குறள் {n}</Text>
      {meaning ? <Text style={s.meaning}>{k.meaning}</Text> : null}
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { borderLeftWidth: 2, borderLeftColor: c.limeDeep, paddingLeft: space(1.5), gap: 2 },
    line: { fontSize: 15, lineHeight: 24, fontWeight: "600", color: c.ink },
    caption: { fontSize: 12, lineHeight: 18, color: c.ink2, marginTop: space(0.5) },
    meaning: { ...f(500, 13, 18), color: c.ink2 },
  });
