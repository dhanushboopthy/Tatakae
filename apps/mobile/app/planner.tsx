import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  RAIL,
  addDays,
  anchorsFor,
  durationLabel,
  hhmmOf,
  isoWeek,
  isoWeekRange,
  railSpan,
  rangeLabel,
  toMinutes,
  weekdayOf,
  type ISODate,
  type Mission,
} from "@tatakae/core";
import { useSettings, useToday } from "../src/lib/hooks";
import { planMission, unplanMission, useAnchors, useBacklog, useMissionsRange, toBacklog } from "../src/lib/planning";
import { longDate, shortDate } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { DateStepper } from "../src/components/DateStepper";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { Stepper } from "../src/components/fitnessUi";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useStyles, useTheme, type Theme } from "../src/lib/theme";

// Week planner (website: Calendar → Week / Day). One day at a time on a 06:00–24:00 rail: anchors are grey blocks,
// planned missions are lime blocks with ink text, unscheduled missions and the backlog sit underneath. There is no
// dragging on a phone, so "Plan" opens a sheet with the day, start time and length. Locked days ask for a reason.

const HOUR_DP = 44;
const RAIL_DP = ((RAIL.endMin - RAIL.startMin) / 60) * HOUR_DP;
const WD = ["S", "M", "T", "W", "T", "F", "S"] as const;

interface Editing {
  mission: Mission | null;
  title: string;
  date: ISODate;
  startMin: number;
  durationMin: number;
}

export default function Planner() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const settings = useSettings().data;
  const focusDefault = settings?.focus_default ?? 50;
  const [anchorDay, setAnchorDay] = useState<ISODate>(today);
  const [selected, setSelected] = useState<ISODate>(today);
  const w = isoWeek(anchorDay);
  const { start, end } = isoWeekRange(w.year, w.week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { data: missions = [] } = useMissionsRange(start, end);
  const { data: anchors = [] } = useAnchors();
  const { data: backlog = [] } = useBacklog();
  const [editing, setEditing] = useState<Editing | null>(null);

  const dayMissions = missions.filter((m) => m.dayDate === selected).sort((a, b) => (a.plannedStart ?? "99").localeCompare(b.plannedStart ?? "99"));
  const planned = dayMissions.filter((m) => m.plannedStart);
  const unscheduled = dayMissions.filter((m) => !m.plannedStart && m.status !== "rescheduled");
  const dayAnchors = anchorsFor(anchors, selected);
  const canPlan = selected >= today;

  const openPlan = (m: Mission | null) =>
    setEditing({
      mission: m,
      title: m?.title ?? "",
      date: m && m.dayDate && m.dayDate >= today ? m.dayDate : canPlan ? selected : today,
      startMin: m?.plannedStart ? toMinutes(m.plannedStart) : 9 * 60,
      durationMin: m?.estMin ?? focusDefault,
    });

  return (
    <Screen sheet>
      <SheetHeader title="Week planner" subtitle={`Week ${w.week} · ${shortDate(start)} – ${shortDate(end)}`} onClose={() => router.back()} />
      <Stepper
        minusLabel="Previous week"
        plusLabel="Next week"
        onMinus={() => {
          const d = addDays(start, -7);
          setAnchorDay(d);
          setSelected(d);
        }}
        onPlus={() => {
          const d = addDays(start, 7);
          setAnchorDay(d);
          setSelected(d);
        }}
        value={<Text style={s.heading}>Week {w.week}</Text>}
      />
      <View style={s.days} accessibilityRole="radiogroup" accessibilityLabel="Day of the week">
        {days.map((d) => (
          <Pressable
            key={d}
            onPress={() => {
              tapLight();
              setSelected(d);
            }}
            accessibilityRole="radio"
            accessibilityLabel={longDate(d)}
            accessibilityState={{ checked: d === selected }}
            style={({ pressed }) => [s.day, d === selected && s.dayOn, pressed && pressedStyle]}
          >
            <Text style={s.dayInitial}>{WD[weekdayOf(d)]}</Text>
            <Text style={[s.dayNum, d === today && s.dayToday]}>{Number(d.slice(8))}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.heading}>{longDate(selected)}</Text>

      {editing ? (
        <PlanSheet key={`${editing.mission?.id ?? "new"}`} edit={editing} today={today} onDone={() => setEditing(null)} />
      ) : (
        <BigButton label={canPlan ? "New mission" : "Past days can't be planned"} variant="secondary" disabled={!canPlan} onPress={() => openPlan(null)} />
      )}

      <Rail date={selected} today={today} anchors={dayAnchors} planned={planned} onOpen={(m) => openPlan(m)} />

      <Card tone="surface">
        <Text style={s.heading}>Not on the rail yet</Text>
        {unscheduled.length === 0 ? <Text style={s.small}>Everything on this day has a time.</Text> : null}
        {unscheduled.map((m) => (
          <Row key={m.id} m={m} action="Plan" onPress={() => openPlan(m)} disabled={!canPlan} />
        ))}
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>Backlog</Text>
        {backlog.length === 0 ? <Text style={s.small}>Nothing waiting.</Text> : null}
        {backlog.map((m) => (
          <Row key={m.id} m={m} action="Plan" onPress={() => openPlan(m)} disabled={!canPlan} />
        ))}
      </Card>
    </Screen>
  );
}

function Row({ m, action, onPress, disabled }: { m: Mission; action: string; onPress: () => void; disabled?: boolean }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.row}>
      <View style={s.flex}>
        <Text style={s.body}>{m.title}</Text>
        {m.estMin ? <Text style={s.small}>{durationLabel(m.estMin)}</Text> : null}
      </View>
      <BigButton label={action} variant="secondary" size="compact" disabled={disabled} onPress={onPress} accessibilityLabel={`${action} ${m.title}`} />
    </View>
  );
}

function Rail(props: { date: ISODate; today: ISODate; anchors: ReturnType<typeof anchorsFor>; planned: Mission[]; onOpen: (m: Mission) => void }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const hours = Array.from({ length: (RAIL.endMin - RAIL.startMin) / 60 + 1 }, (_, i) => RAIL.startMin / 60 + i);
  return (
    <Card tone="surface">
      <View style={[s.rail, { height: RAIL_DP }]} accessible={false}>
        {hours.map((h) => (
          <View key={h} style={[s.hourLine, { top: ((h * 60 - RAIL.startMin) / (RAIL.endMin - RAIL.startMin)) * RAIL_DP }]}>
            <Text style={s.hourText}>{h === 24 ? "" : `${String(h).padStart(2, "0")}`}</Text>
          </View>
        ))}
        {props.anchors.map((a) => {
          const startMin = toMinutes(a.startTime);
          const dur = Math.max(15, (toMinutes(a.endTime) > startMin ? toMinutes(a.endTime) : 24 * 60) - startMin);
          const span = railSpan(startMin, dur);
          if (!span) return null;
          return (
            <View
              key={a.id}
              accessible
              accessibilityLabel={`${a.name}, ${a.startTime} to ${a.endTime}`}
              style={[s.block, s.anchor, { top: span.top * RAIL_DP, height: Math.max(22, span.height * RAIL_DP) }]}
            >
              <Text style={s.blockText} numberOfLines={1}>
                {a.name} · {a.startTime}–{a.endTime}
              </Text>
            </View>
          );
        })}
        {props.planned.map((m) => {
          const startMin = toMinutes(m.plannedStart ?? "09:00");
          const dur = m.estMin ?? 30;
          const span = railSpan(startMin, dur);
          if (!span) return null;
          return (
            <Pressable
              key={m.id}
              onPress={() => props.onOpen(m)}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}, ${rangeLabel(startMin, dur)}. Change the plan`}
              style={({ pressed }) => [s.block, s.mission, { top: span.top * RAIL_DP, height: Math.max(30, span.height * RAIL_DP), borderColor: c.limeDeep }, pressed && pressedStyle]}
            >
              <Text style={s.missionText} numberOfLines={2}>
                {m.title}
              </Text>
              <Text style={s.missionSub}>{rangeLabel(startMin, dur)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function PlanSheet({ edit, today, onDone }: { edit: Editing; today: ISODate; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const [title, setTitle] = useState(edit.title);
  const [date, setDate] = useState<ISODate>(edit.date);
  const [startMin, setStartMin] = useState(edit.startMin);
  const [durationMin, setDurationMin] = useState(edit.durationMin);
  const [reason, setReason] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const m = edit.mission;
  const lastStart = RAIL.endMin - 15;

  async function save() {
    if (busy) return;
    if (!m && !title.trim()) return void setProblem("Give it a title.");
    setBusy(true);
    try {
      const out = await planMission({ mission: m, title, date, plannedStart: hhmmOf(startMin), estMin: durationMin, reason });
      if (out.ok) {
        tapDone();
        return onDone();
      }
      if (out.why === "needs_reason") {
        setNeedReason(true);
        setProblem("That day's plan is locked. Say why you're changing it.");
      } else setProblem("That day already has nine missions and a side quest. Pick another day.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="surface">
      <Text style={s.heading}>{m ? "Plan this mission" : "New mission"}</Text>
      {m ? <Text style={s.body}>{m.title}</Text> : <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} />}
      <DateStepper label="Day" value={date} onChange={setDate} min={today} />
      <Text style={s.label}>Starts at</Text>
      <Stepper
        minusLabel="Start 15 minutes earlier"
        plusLabel="Start 15 minutes later"
        onMinus={() => setStartMin((v) => Math.max(RAIL.startMin, v - 15))}
        onPlus={() => setStartMin((v) => Math.min(lastStart, v + 15))}
        value={<Text style={s.time}>{hhmmOf(startMin)}</Text>}
      />
      <Text style={s.label}>Length</Text>
      <Stepper
        minusLabel="Shorter by 5 minutes"
        plusLabel="Longer by 5 minutes"
        onMinus={() => setDurationMin((v) => Math.max(5, v - 5))}
        onPlus={() => setDurationMin((v) => Math.min(480, v + 5))}
        value={<Text style={s.time}>{durationLabel(durationMin)}</Text>}
      />
      {needReason ? <TextField label="Why change a locked plan?" value={reason} onChangeText={setReason} maxLength={250} /> : null}
      {problem ? (
        <Text accessibilityRole="alert" style={s.body}>
          {problem}
        </Text>
      ) : null}
      <BigButton label="Save" variant="accent" busy={busy} onPress={() => void save()} />
      {m?.plannedStart ? (
        <BigButton
          label="Take off the rail"
          variant="secondary"
          size="compact"
          onPress={async () => {
            await unplanMission(m);
            onDone();
          }}
        />
      ) : null}
      {m && m.dayDate && m.slot !== "backlog" ? (
        <BigButton
          label="Back to the backlog"
          variant="quiet"
          size="compact"
          onPress={async () => {
            await toBacklog(m);
            onDone();
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink2 },
    heading: { ...f(600, 17, 24), color: c.ink },
    time: { ...f(600, 20, 28), color: c.ink, minWidth: 130, textAlign: "center", fontVariant: ["tabular-nums"] },
    flex: { flex: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: space(1.5), paddingVertical: space(0.5) },
    days: { flexDirection: "row", justifyContent: "space-between" },
    day: { width: 44, minHeight: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 },
    dayOn: { backgroundColor: c.lime },
    dayInitial: { ...f(600, 12, 16), color: c.ink2 },
    dayNum: { ...f(600, 16, 22), color: c.ink, fontVariant: ["tabular-nums"] },
    dayToday: { textDecorationLine: "underline" },
    rail: { marginLeft: 28 },
    hourLine: { position: "absolute", left: -28, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    hourText: { ...f(500, 11, 14), color: c.ink2, marginTop: -7, backgroundColor: "transparent" },
    block: { position: "absolute", left: 4, right: 0, borderRadius: 12, paddingHorizontal: space(1), paddingVertical: 4, justifyContent: "center", overflow: "hidden" },
    anchor: { backgroundColor: c.surface2 },
    blockText: { ...f(500, 12, 16), color: c.ink2 },
    mission: { backgroundColor: c.limeSoft, borderWidth: 1.5, left: 44 },
    missionText: { ...f(600, 13, 16), color: c.onFill },
    missionSub: { ...f(500, 11, 14), color: c.onFill },
  });
