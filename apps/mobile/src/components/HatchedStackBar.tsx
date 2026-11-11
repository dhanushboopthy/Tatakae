import { StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, G, Line, Pattern, Rect } from "react-native-svg";
import type { CalendarDay, ISODate } from "@tatakae/core";
import { f, space } from "../theme";
import { useStyles, useTheme, type Theme } from "../lib/theme";
import { longDate, weekdayInitial } from "../lib/format";

/**
 * Per-day stacked bars (docs/11 C1, ref 03): done = lime with a deep top edge, minimum = lavender
 * 45° hatch, missed = grey hatch with a grey edge, still open = dashed outline. Rounded tops; day letter
 * and date circle under each bar (today charcoal). One-line summary and a legend under it.
 */
export function HatchedStackBar(props: { days: readonly CalendarDay[]; today: ISODate; summary: string; height?: number }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const h = props.height ?? 170;
  const n = Math.max(1, props.days.length);
  const W = 336;
  const gap = 8;
  const bw = (W - gap * (n - 1)) / n;
  const max = Math.max(3, ...props.days.map((d) => d.done + d.minimum + d.missed + d.open));
  const px = (points: number) => (points / max) * (h - 8);

  const describe = (d: CalendarDay) => {
    const parts = [d.done && `${d.done} done`, d.minimum && `${d.minimum} minimum`, d.missed && `${d.missed} missed`, d.open && `${d.open} open`].filter(Boolean);
    return `${longDate(d.date)}: ${parts.length ? parts.join(", ") : "nothing planned"}`;
  };

  return (
    <View style={s.wrap}>
      <View accessible accessibilityRole="image" accessibilityLabel={`Points per day. ${props.days.map(describe).join("; ")}.`}>
        <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
          <Defs>
            <Pattern id="hatch-min" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <Rect width="8" height="8" fill={c.lavender} />
              <Line x1="0" y1="0" x2="0" y2="8" stroke={c.lavenderSoft} strokeWidth="4" />
            </Pattern>
            <Pattern id="hatch-missed" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <Rect width="8" height="8" fill={c.surface2} />
              <Line x1="0" y1="0" x2="0" y2="8" stroke={c.line} strokeWidth="4" />
            </Pattern>
          </Defs>
          {props.days.map((d, i) => {
            const x = i * (bw + gap);
            let y = h;
            const seg = (pts: number) => {
              const hh = px(pts);
              y -= hh;
              return { y, hh };
            };
            const done = d.done > 0 ? seg(d.done) : null;
            const min = d.minimum > 0 ? seg(d.minimum) : null;
            const missed = d.missed > 0 ? seg(d.missed) : null;
            const open = d.open > 0 ? seg(d.open) : null;
            return (
              <Svg key={d.date} x={x} width={bw} height={h}>
                <Defs>
                  <ClipPath id={`bar-${i}`}>
                    <Rect x={0} y={0} width={bw} height={h} rx={12} />
                  </ClipPath>
                </Defs>
                <Rect x={0} y={0} width={bw} height={h} rx={12} fill={c.surface2} />
                <G clipPath={`url(#bar-${i})`}>
                  {done ? <Rect x={0} y={done.y} width={bw} height={done.hh} fill={c.lime} /> : null}
                  {done ? <Rect x={0} y={done.y} width={bw} height={2} fill={c.limeDeep} /> : null}
                  {min ? <Rect x={0} y={min.y} width={bw} height={min.hh} fill="url(#hatch-min)" /> : null}
                  {missed ? <Rect x={0} y={missed.y} width={bw} height={missed.hh} fill="url(#hatch-missed)" /> : null}
                  {missed ? <Rect x={0} y={missed.y} width={bw} height={2} fill={c.missed} /> : null}
                </G>
                {open ? (
                  <Rect x={1} y={open.y + 1} width={bw - 2} height={open.hh - 2} rx={8} fill="none" stroke={c.missed} strokeWidth={2} strokeDasharray="4 3" />
                ) : null}
                {d.date === props.today ? <Rect x={1} y={1} width={bw - 2} height={h - 2} rx={11} fill="none" stroke={c.hero} strokeWidth={2} /> : null}
              </Svg>
            );
          })}
        </Svg>
      </View>
      <View style={s.labels} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {props.days.map((d) => (
          <View key={d.date} style={s.label}>
            <Text style={s.letter}>{weekdayInitial(d.date)}</Text>
            <View style={[s.date, d.date === props.today && s.dateToday]}>
              <Text style={[s.dateText, d.date === props.today && s.dateTextToday]}>{Number(d.date.slice(8))}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={s.summary}>{props.summary}</Text>
      <BarLegend />
    </View>
  );
}

export function BarLegend() {
  const s = useStyles(makeStyles);
  return (
    <View style={s.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.legendItem}>
        <View style={[s.swatch, s.swDone]} />
        <Text style={s.legendText}>Done</Text>
      </View>
      <View style={s.legendItem}>
        <View style={[s.swatch, s.swMin]} />
        <Text style={s.legendText}>Minimum</Text>
      </View>
      <View style={s.legendItem}>
        <View style={[s.swatch, s.swMissed]} />
        <Text style={s.legendText}>Missed</Text>
      </View>
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    wrap: { gap: space(1) },
    labels: { flexDirection: "row", gap: 8 },
    label: { flex: 1, alignItems: "center", gap: 2 },
    letter: { ...f(600, 12, 16), color: c.ink },
    date: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 },
    dateToday: { backgroundColor: c.hero },
    dateText: { ...f(500, 12), color: c.ink2, fontVariant: ["tabular-nums"] },
    dateTextToday: { color: c.onHero },
    summary: { ...f(500, 13, 18), color: c.ink2 },
    legend: { flexDirection: "row", gap: space(1.5) },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    swDone: { backgroundColor: c.lime, borderWidth: 1.5, borderColor: c.limeDeep },
    swMin: { backgroundColor: c.lavender },
    swMissed: { backgroundColor: c.surface2, borderWidth: 1.5, borderColor: c.missed },
    legendText: { ...f(500, 13, 18), color: c.ink2 },
  });
