import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { saveSetting, useCycleStats, useSettings, useToday } from "../src/lib/hooks";
import { AREA_COLORS, UNASSIGNED, isAreaColor } from "../src/lib/colors";
import { longDate, shortDate } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { DateStepper } from "../src/components/DateStepper";
import { tapDone } from "../src/haptics";
import type { ISODate } from "@tatakae/core";
import { SegmentGauge } from "../src/components/SegmentGauge";
import { RingProgress } from "../src/components/RingProgress";
import { Kural } from "../src/components/Kural";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { f, space } from "../src/theme";
import { useStyles, type Theme } from "../src/lib/theme";

const WEEK_WORD = { Strong: "Strong", Solid: "Solid", Light: "Light", Unplanned: "Rest", Missed: "Grey", Future: "Ahead" } as const;

/**
 * Cycle, read-only on the phone (docs/11 C4/C5, ref 04): the 12-segment gauge with days shown up,
 * goal rings and the weeks so far. Goals and experiments are edited on the laptop.
 */
export default function Cycle() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const { data: cycle } = useCycleStats();
  const weekIndex = cycle ? cycle.weeks.findIndex((w) => today >= w.start && today <= w.end) + 1 : 0;

  return (
    <Screen sheet>
      <SheetHeader
        title={`Cycle ${cycle?.index ?? 1}`}
        subtitle={cycle ? `${shortDate(cycle.start)} – ${shortDate(cycle.end)}${weekIndex ? ` · week ${weekIndex} of ${cycle.weeks.length}` : ""}` : undefined}
        onClose={() => router.back()}
      />
      <Kural n={595} />
      <CycleStart />
      {cycle ? (
        <>
          <Card tone="surface">
            <Text style={s.heading}>Days shown up</Text>
            <SegmentGauge
              marks={cycle.weekMarks}
              pct={cycle.pct}
              word={cycle.word}
              label={`Cycle gauge: ${cycle.daysShownUp} of ${cycle.daysElapsed} days shown up; weeks: ${cycle.weekMarks.join(", ")}.`}
            />
            <Text style={s.small}>
              {cycle.daysShownUp} of {cycle.daysElapsed} days so far. Rest and write-off days don't count against you.
            </Text>
          </Card>

          <Card tone="surface">
            <Text style={s.heading}>Cycle goals</Text>
            {cycle.goals.length === 0 ? <Text style={s.small}>No goals yet. Set up to four on the laptop.</Text> : null}
            {cycle.goals.map((g) => {
              const col = isAreaColor(g.color) ? AREA_COLORS[g.color] : UNASSIGNED;
              return (
                <View key={g.id} style={s.goal}>
                  <RingProgress pct={g.progressPct} color={col.deep} accessibilityLabel={`${g.name}: ${g.progressPct}%`} />
                  <View style={s.flex}>
                    <Text style={s.goalName}>{g.name}</Text>
                    <Text style={s.small}>
                      {g.earned}
                      {g.target != null ? ` of ${g.target}` : ""} points
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>

          <Card tone="surface">
            <Text style={s.heading}>Weeks</Text>
            {cycle.weeks
              .filter((w) => w.start <= today)
              .map((w) => (
                <View key={w.index} style={s.week}>
                  <Text style={s.body}>
                    Week {w.index + 1} · {shortDate(w.start)}
                  </Text>
                  <Text style={s.small}>
                    {WEEK_WORD[w.mark]}
                    {w.average != null ? ` · avg ${w.average}` : ""}
                  </Text>
                </View>
              ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** Cycle 1's first day; every later 12-week cycle follows it, so moving it moves them all. */
function CycleStart() {
  const s = useStyles(makeStyles);
  const start = useSettings().data?.["cycle.start"];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<ISODate | null>(null);
  const [saved, setSaved] = useState(false);
  if (!start) return null;
  return (
    <Card tone="surface">
      <Text style={s.heading}>Cycle 1 starts on {longDate(start)}</Text>
      {editing ? (
        <>
          <DateStepper label="Cycle 1 starts on" value={value ?? start} onChange={setValue} />
          <Text style={s.small}>Each cycle is 12 weeks, so later cycles move with it. Your logged days and goals stay as they are.</Text>
          <BigButton
            label="Save start date"
            variant="accent"
            disabled={(value ?? start) === start}
            onPress={async () => {
              await saveSetting("cycle.start", value ?? start);
              tapDone();
              setSaved(true);
              setEditing(false);
            }}
          />
          <BigButton label="Cancel" variant="quiet" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          {saved ? <Text style={s.small}>Saved.</Text> : null}
          <BigButton
            label="Change start date"
            variant="secondary"
            onPress={() => {
              setValue(start);
              setSaved(false);
              setEditing(true);
            }}
          />
        </>
      )}
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    heading: { ...f(600, 16, 22), color: c.ink },
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    goal: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
    goalName: { ...f(600, 15, 22), color: c.ink },
    flex: { flex: 1 },
    week: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space(0.75), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  });
