import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  AFTER_P1,
  DEFAULT_RANKED,
  FORGE_PROBLEM_COPY,
  MAX_RANKED,
  RANKED_SLOTS,
  RITUAL_RESTART,
  addDays,
  anchorsFor,
  bySlot,
  freeMinutes,
  plannedMinutes,
  type Anchor,
  type ISODate,
  type Mission,
  type RankedSlot,
  type ResolvedSettings,
} from "@tatakae/core";
import { setDayFlag, setStatus, updateDay, useDay, useToday, type DayView } from "../src/lib/hooks";
import {
  deleteMission,
  forge,
  loadRitualProgress,
  patchMissionFree,
  restartRitual,
  saveRitualProgress,
  toBacklog,
  upsertMission,
  useAnchors,
  useBacklog,
  useIfThenTemplates,
  type RitualProgress,
  type RestartOutcome,
} from "../src/lib/planning";
import { longDate } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { CapacityBar } from "../src/components/CapacityBar";
import { Kural } from "../src/components/Kural";
import { SLOT_LABEL } from "../src/components/MissionCard";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { StatusChips } from "../src/components/StatusChips";
import { TextField } from "../src/components/TextField";
import { Stepper } from "../src/components/fitnessUi";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useForceDark, useStyles, useTheme, type Theme } from "../src/lib/theme";

// Night ritual on the phone (docs/02, docs/05): the same eight steps as the website, about five minutes.
// Every step saves to the local store as you go (works offline), the current step is remembered per day so an
// interrupted ritual resumes where it stopped, and the plan lock is validated here and again on the server.
// Always dark, like the website's ritual.

const STEPS = ["Close today", "Small win", "Three questions", "Close loops", "Capacity", "Pick missions", "Side quest", "Shutdown"] as const;
const LAST = STEPS.length - 1;

export default function Ritual() {
  const s = useStyles(makeStyles);
  useForceDark(true);
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const todayQ = useDay(today);
  const tomorrowQ = useDay(tomorrow);
  const anchorsQ = useAnchors();
  const [progress, setProgress] = useState<RitualProgress | null>(null);
  const [justForged, setJustForged] = useState(false);
  const loadedFor = useRef<ISODate | null>(null);

  useEffect(() => {
    if (loadedFor.current === today) return;
    loadedFor.current = today;
    void loadRitualProgress(today).then(setProgress);
  }, [today]);

  const update = useCallback(
    (patch: Partial<RitualProgress>) => {
      setProgress((p) => {
        const base = p ?? { step: 0, reached: 0, freeMin: null };
        const next = { ...base, ...patch };
        next.step = Math.max(0, Math.min(LAST, next.step));
        next.reached = Math.max(next.reached, next.step);
        void saveRitualProgress(today, next);
        return next;
      });
    },
    [today],
  );

  const todayView = todayQ.data;
  const tomorrowView = tomorrowQ.data;
  const anchors = anchorsQ.data;
  if (!todayView || !tomorrowView || !anchors || !progress) {
    return (
      <Screen sheet>
        <SheetHeader title="Night ritual" onClose={() => router.back()} />
        <Text style={s.body}>Opening the ritual…</Text>
      </Screen>
    );
  }

  if (tomorrowView.forged) {
    return (
      <ShutdownComplete
        fresh={justForged}
        date={tomorrow}
        onRestarted={() => {
          update({ step: 0, reached: 0, freeMin: null });
          setJustForged(false);
        }}
      />
    );
  }

  const step = progress.step;
  const next = () => update({ step: step + 1 });
  const back = () => update({ step: step - 1 });
  const settings = tomorrowView.settings;
  const tomorrowAnchors = anchorsFor(anchors, tomorrow);

  return (
    <Screen sheet>
      <SheetHeader title="Night ritual" subtitle="About five minutes" onClose={() => router.back()} />
      <Progress step={step} reached={progress.reached} />
      <Text style={s.stepTitle} accessibilityRole="header">
        {step + 1}/8 · {STEPS[step]}
      </Text>

      {step === 0 && <CloseToday view={todayView} onNext={next} />}
      {step === 1 && <SmallWin view={todayView} onNext={next} onBack={back} />}
      {step === 2 && <Questions view={todayView} onNext={next} onBack={back} />}
      {step === 3 && <CloseLoops view={todayView} onNext={next} onBack={back} />}
      {step === 4 && (
        <Capacity
          tomorrow={tomorrowView}
          anchors={tomorrowAnchors}
          settings={settings}
          freeMin={progress.freeMin}
          onNext={(freeMin) => update({ freeMin, step: step + 1 })}
          onBack={back}
        />
      )}
      {step === 5 && (
        <PickMissions
          tomorrow={tomorrowView}
          settings={settings}
          freeMin={progress.freeMin ?? defaultFree(settings, tomorrowAnchors)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 6 && <SideQuest tomorrow={tomorrowView} onNext={next} onBack={back} />}
      {step === 7 && <Shutdown tomorrow={tomorrowView} onBack={back} onFixPlan={() => update({ step: 5 })} onForged={() => setJustForged(true)} />}

      <Pressable onPress={() => router.replace("/quick-close")} accessibilityRole="button" style={({ pressed }) => [s.quiet, pressed && pressedStyle]}>
        <Text style={s.quietText}>Short on time? Quick close instead</Text>
      </Pressable>
    </Screen>
  );
}

const defaultFree = (settings: ResolvedSettings, anchors: readonly Anchor[]): number =>
  freeMinutes({ wakeTime: settings.wake_time, ritualTime: settings.ritual_time, anchors });

const slotsOf = (view: DayView) => bySlot(view.missions);

// ---------- chrome ----------

function Progress({ step, reached }: { step: number; reached: number }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.dots} accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      {STEPS.map((name, i) => (
        <View key={name} style={[s.dot, i === step ? s.dotNow : i <= reached ? s.dotDone : s.dotTodo]} />
      ))}
    </View>
  );
}

function Actions(props: { onBack?: () => void; onSkip?: () => void; onNext: () => void | Promise<void>; nextLabel?: string; busy?: boolean; disabled?: boolean }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.actions}>
      <BigButton label={props.nextLabel ?? "Next"} variant="accent" onPress={() => void props.onNext()} busy={props.busy} disabled={props.disabled} />
      <View style={s.actionsRow}>
        {props.onBack ? <BigButton label="Back" variant="quiet" size="compact" onPress={props.onBack} style={s.flex} /> : <View style={s.flex} />}
        {props.onSkip ? <BigButton label="Skip" variant="quiet" size="compact" onPress={props.onSkip} style={s.flex} /> : <View style={s.flex} />}
      </View>
    </View>
  );
}

/** Run an async save once at a time, then continue. */
function useSubmit(then: () => void) {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      then();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ---------- 1. close today ----------

function CloseToday({ view, onNext }: { view: DayView; onNext: () => void }) {
  const s = useStyles(makeStyles);
  const [screen, setScreen] = useState(view.day?.screenMin != null ? String(view.day.screenMin) : "");
  const { busy, run } = useSubmit(onNext);
  const missions = view.missions.filter((m) => m.status !== "rescheduled");
  return (
    <>
      {missions.length === 0 ? (
        <Text style={s.body}>Nothing was planned today. That's fine — tomorrow starts tonight.</Text>
      ) : (
        missions.map((m) => (
          <Card key={m.id} tone="surface">
            <Text style={s.slot}>{SLOT_LABEL[m.slot]}</Text>
            <Text style={s.cardTitle}>{m.title}</Text>
            <StatusChips status={m.status} onChange={(st) => void setStatus(m, st)} missionTitle={m.title} />
          </Card>
        ))
      )}
      <TextField
        label="Recreational screen minutes today"
        hint="Phone's digital wellbeing has the number. Up to 120 is free."
        value={screen}
        onChangeText={(v) => setScreen(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Actions
        busy={busy}
        onNext={() =>
          run(async () => {
            const n = Number.parseInt(screen, 10);
            await updateDay(view.date, { screenMin: Number.isFinite(n) ? Math.min(1440, Math.max(0, n)) : null });
          })
        }
      />
    </>
  );
}

// ---------- 2. small win ----------

function SmallWin({ view, onNext, onBack }: { view: DayView; onNext: () => void; onBack: () => void }) {
  const [win, setWin] = useState(view.day?.smallWin ?? "");
  const { busy, run } = useSubmit(onNext);
  return (
    <>
      <TextField label="One small win from today" value={win} onChangeText={setWin} maxLength={200} placeholder="e.g. Finished the VPC module before lunch" />
      <Actions busy={busy} onBack={onBack} onSkip={onNext} onNext={() => run(async () => void (await updateDay(view.date, { smallWin: win.trim() || null })))} />
    </>
  );
}

// ---------- 3. three questions ----------

function Questions({ view, onNext, onBack }: { view: DayView; onNext: () => void; onBack: () => void }) {
  const s = useStyles(makeStyles);
  const d = view.day;
  const [qP1, setQP1] = useState(d?.qP1 ?? "");
  const [qDrift, setQDrift] = useState(d?.qDrift ?? "");
  const [qPractised, setQPractised] = useState(d?.qPractised ?? "");
  const { busy, run } = useSubmit(onNext);
  return (
    <>
      <View style={s.group}>
        <Text style={s.label}>Did you do P1?</Text>
        <View style={s.chips}>
          {["Yes", "The Minimum", "Not this time"].map((a) => (
            <Pressable
              key={a}
              onPress={() => {
                tapLight();
                setQP1(a);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: qP1 === a }}
              style={({ pressed }) => [s.chip, qP1 === a && s.chipOn, pressed && pressedStyle]}
            >
              <Text style={s.chipText}>{qP1 === a ? "✓ " : ""}{a}</Text>
            </Pressable>
          ))}
        </View>
        <TextField accessibilityLabel="Did you do P1? In your own words" value={qP1} onChangeText={setQP1} maxLength={300} />
      </View>
      <TextField label="What made you drift?" value={qDrift} onChangeText={setQDrift} maxLength={300} />
      <TextField label="What did you practise?" value={qPractised} onChangeText={setQPractised} maxLength={300} />
      <Actions
        busy={busy}
        onBack={onBack}
        onNext={() =>
          run(async () => {
            await updateDay(view.date, { qP1: qP1.trim() || null, qDrift: qDrift.trim() || null, qPractised: qPractised.trim() || null });
          })
        }
      />
    </>
  );
}

// ---------- 4. close loops ----------

function CloseLoops({ view, onNext, onBack }: { view: DayView; onNext: () => void; onBack: () => void }) {
  const s = useStyles(makeStyles);
  const open = view.missions.filter((m) => m.status !== "done" && m.status !== "rescheduled");
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(open.map((m) => [m.id, m.resumeNote ?? ""] as const)));
  const { busy, run } = useSubmit(onNext);
  return (
    <>
      {open.length === 0 ? (
        <Text style={s.body}>No open loops. Everything from today is closed.</Text>
      ) : (
        <>
          <Text style={s.small}>For each unfinished mission: where should you pick up next time?</Text>
          {open.map((m) => (
            <TextField
              key={m.id}
              label={m.title}
              value={notes[m.id] ?? ""}
              onChangeText={(v) => setNotes((n) => ({ ...n, [m.id]: v }))}
              maxLength={500}
              placeholder="e.g. Next: write the outputs.tf for the subnet"
            />
          ))}
        </>
      )}
      <Actions
        busy={busy}
        onBack={onBack}
        onNext={() =>
          run(async () => {
            for (const m of open) {
              const v = (notes[m.id] ?? "").trim() || null;
              if (v !== m.resumeNote) await patchMissionFree(m, { resumeNote: v });
            }
          })
        }
      />
    </>
  );
}

// ---------- 5. capacity ----------

const FREE_STEP = 15;

function Capacity(props: { tomorrow: DayView; anchors: Anchor[]; settings: ResolvedSettings; freeMin: number | null; onNext: (freeMin: number) => void; onBack: () => void }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const suggested = defaultFree(props.settings, props.anchors);
  const [free, setFree] = useState(String(props.freeMin ?? suggested));
  const freeN = Number.parseInt(free, 10) || 0;
  const nudge = (d: number) => setFree(String(Math.min(1440, Math.max(0, freeN + d))));
  return (
    <>
      <Text style={s.heading}>Tomorrow's anchors</Text>
      {props.anchors.length === 0 ? (
        <Text style={s.small}>No fixed blocks tomorrow. Add anchors in Settings.</Text>
      ) : (
        <View style={s.chips}>
          {props.anchors.map((a) => (
            <View key={a.id} style={s.anchor}>
              <Text style={s.anchorName}>{a.name}</Text>
              <Text style={s.anchorTime}>
                {a.startTime}–{a.endTime}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={s.label}>Free minutes tomorrow</Text>
      <Stepper
        minusLabel={`Minus ${FREE_STEP} minutes`}
        plusLabel={`Plus ${FREE_STEP} minutes`}
        onMinus={() => nudge(-FREE_STEP)}
        onPlus={() => nudge(FREE_STEP)}
        value={
          <TextFieldInline value={free} onChange={(v) => setFree(v.replace(/[^0-9]/g, ""))} label="Free minutes tomorrow" color={c.ink} placeholder={c.ink2} />
        }
      />
      <Text style={s.small}>
        Suggested {suggested} min: wake {props.settings.wake_time} to ritual {props.settings.ritual_time}, minus anchors.
      </Text>
      <CapacityBar plannedMin={plannedMinutes(props.tomorrow.missions)} freeMin={freeN} scoring={props.settings.scoring} />
      <Kural n={475} meaning={false} />
      <Actions onBack={props.onBack} onNext={() => props.onNext(freeN)} />
    </>
  );
}

function TextFieldInline(props: { value: string; onChange: (v: string) => void; label: string; color: string; placeholder: string }) {
  const s = useStyles(makeStyles);
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
      keyboardType="number-pad"
      accessibilityLabel={props.label}
      maxLength={4}
      placeholder="0"
      placeholderTextColor={props.placeholder}
      style={[s.bigInput, { color: props.color }]}
    />
  );
}

// ---------- 6. pick missions (5 by default, up to 9) ----------

interface SlotDraft {
  /** Existing mission (tomorrow's, or picked from the backlog). */
  source: Mission | null;
  title: string;
  minimum: string;
  ifThen: string;
  estMin: string;
  points: number;
}

const RANKED: readonly RankedSlot[] = RANKED_SLOTS;

const draftFrom = (m: Mission | undefined): SlotDraft => ({
  source: m ?? null,
  title: m?.title ?? "",
  minimum: m?.minimum ?? "",
  ifThen: m?.ifThen ?? "",
  estMin: m?.estMin != null ? String(m.estMin) : "",
  points: m?.points ?? 1,
});

function PickMissions(props: { tomorrow: DayView; settings: ResolvedSettings; freeMin: number; onNext: () => void; onBack: () => void }) {
  const s = useStyles(makeStyles);
  const slots = slotsOf(props.tomorrow);
  const { data: backlog = [] } = useBacklog();
  const { data: templates = [] } = useIfThenTemplates();
  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>(() => Object.fromEntries(RANKED.map((sl) => [sl, draftFrom(slots[sl])] as const)));
  const [rows, setRows] = useState(() => Math.min(MAX_RANKED, Math.max(DEFAULT_RANKED, RANKED.reduce((n, sl, i) => (slots[sl] ? i + 1 : n), 0))));
  const [pickFor, setPickFor] = useState<RankedSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useSubmit(props.onNext);

  const set = (slot: string, patch: Partial<SlotDraft>) => setDrafts((d) => ({ ...d, [slot]: { ...(d[slot] ?? draftFrom(undefined)), ...patch } }));
  const usedIds = new Set(Object.values(drafts).map((d) => d.source?.id).filter(Boolean));
  const plannedMin = RANKED.reduce((sum, sl) => sum + (drafts[sl]?.title.trim() ? Number.parseInt(drafts[sl]?.estMin ?? "", 10) || 0 : 0), 0);

  async function save() {
    const p1 = drafts.P1;
    if (!p1 || !p1.title.trim()) return void setError("Pick a P1 — the one mission that makes tomorrow a win.");
    if (!p1.minimum.trim() || !p1.ifThen.trim()) return void setError("P1 needs a Minimum version and an if-then plan.");
    setError(null);
    await run(async () => {
      for (const slot of RANKED) {
        const d = drafts[slot];
        if (!d) continue;
        const title = d.title.trim();
        if (!title) {
          // Cleared: send the mission back to the backlog rather than losing it.
          if (d.source && d.source.dayDate === props.tomorrow.date) await toBacklog(d.source);
          continue;
        }
        const est = Number.parseInt(d.estMin, 10);
        const fields = {
          title,
          minimum: d.minimum.trim() || null,
          ifThen: d.ifThen.trim() || null,
          estMin: Number.isFinite(est) && est > 0 ? est : null,
          points: d.points === 1 ? null : d.points,
          dayDate: props.tomorrow.date,
          slot,
          status: "open" as const,
        };
        await upsertMission(d.source ? { ...d.source, ...fields } : fields);
      }
      // Missions that were on tomorrow's ranked slots but got replaced by a backlog pick.
      for (const slot of RANKED) {
        const prev = slots[slot];
        if (prev && !usedIds.has(prev.id)) await toBacklog(prev);
      }
      tapDone();
    });
  }

  const free = backlog.filter((b) => !usedIds.has(b.id));
  return (
    <>
      <Text style={s.small}>
        Ranked, {DEFAULT_RANKED} to start and up to {MAX_RANKED}. P1 is the one that makes tomorrow a win. Leave the rest blank if the day is full.
      </Text>
      {RANKED.slice(0, rows).map((slot) => {
        const d = drafts[slot] ?? draftFrom(undefined);
        const isP1 = slot === "P1";
        return (
          <Card key={slot} tone="surface">
            <View style={s.slotHead}>
              <View style={[s.pill, isP1 && s.pillP1]}>
                <Text style={s.pillText}>{slot}</Text>
              </View>
              <Text style={s.small}>{isP1 ? "Needs a Minimum and an if-then" : "Optional"}</Text>
            </View>
            <TextField label="Mission" value={d.title} onChangeText={(v) => set(slot, { title: v })} maxLength={200} accessibilityLabel={`${slot} mission`} />
            {free.length > 0 && !d.source ? (
              <BigButton label={`…or pick ${slot} from the backlog (${free.length})`} variant="secondary" size="compact" onPress={() => setPickFor(pickFor === slot ? null : slot)} />
            ) : null}
            {pickFor === slot
              ? free.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      tapLight();
                      set(slot, draftFrom(b));
                      setPickFor(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${b.title}`}
                    style={({ pressed }) => [s.pick, pressed && pressedStyle]}
                  >
                    <Text style={s.cardTitle}>{b.title}</Text>
                    {b.rescheduleCount > 1 ? <Text style={s.small}>moved {b.rescheduleCount}×</Text> : null}
                  </Pressable>
                ))
              : null}
            {isP1 ? (
              <>
                <TextField label="Minimum version" value={d.minimum} onChangeText={(v) => set(slot, { minimum: v })} maxLength={200} placeholder="The smallest thing that still counts" />
                <TextField label="If-then plan" value={d.ifThen} onChangeText={(v) => set(slot, { ifThen: v })} maxLength={300} placeholder="If it's 7:00 and I've had tea, then I open the laptop and start" />
                {templates.length > 0 ? (
                  <View style={s.chips}>
                    {templates.map((t) => (
                      <Pressable key={t} onPress={() => set(slot, { ifThen: t })} accessibilityRole="button" accessibilityLabel={`Use plan: ${t}`} style={({ pressed }) => [s.chip, pressed && pressedStyle]}>
                        <Text style={s.chipText} numberOfLines={1}>
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            <TextField
              label="Estimate (min)"
              value={d.estMin}
              onChangeText={(v) => set(slot, { estMin: v.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Stepper
              minusLabel={`${slot} points: minus one`}
              plusLabel={`${slot} points: plus one`}
              onMinus={() => set(slot, { points: Math.max(1, d.points - 1) })}
              onPlus={() => set(slot, { points: Math.min(5, d.points + 1) })}
              value={<Text style={s.points}>{d.points} {d.points === 1 ? "point" : "points"}</Text>}
            />
            {d.source || d.title ? <BigButton label={`Clear ${slot}`} variant="quiet" size="compact" onPress={() => set(slot, draftFrom(undefined))} /> : null}
          </Card>
        );
      })}
      {rows < MAX_RANKED ? <BigButton label={`Add ${RANKED[rows]}`} variant="secondary" onPress={() => setRows((n) => Math.min(MAX_RANKED, n + 1))} /> : null}
      <CapacityBar plannedMin={plannedMin} freeMin={props.freeMin} scoring={props.settings.scoring} />
      {error ? (
        <Text accessibilityRole="alert" style={s.body}>
          {error}
        </Text>
      ) : null}
      <Actions busy={busy} onBack={props.onBack} onNext={save} />
    </>
  );
}

// ---------- 7. side quest ----------

function SideQuest({ tomorrow, onNext, onBack }: { tomorrow: DayView; onNext: () => void; onBack: () => void }) {
  const existing = slotsOf(tomorrow).side;
  const [title, setTitle] = useState(existing?.title ?? "");
  const { busy, run } = useSubmit(onNext);
  return (
    <>
      <TextField
        label="One side quest (optional, unscored)"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        placeholder="Something light you'd enjoy, e.g. 15 min of Japanese kana"
      />
      <Actions
        busy={busy}
        onBack={onBack}
        onSkip={onNext}
        onNext={() =>
          run(async () => {
            const t = title.trim();
            if (t) await upsertMission(existing ? { ...existing, title: t } : { title: t, slot: "side", dayDate: tomorrow.date });
            else if (existing) await deleteMission(existing);
          })
        }
      />
    </>
  );
}

// ---------- 8. shutdown ----------

function Shutdown(props: { tomorrow: DayView; onBack: () => void; onFixPlan: () => void; onForged: () => void }) {
  const s = useStyles(makeStyles);
  const slots = slotsOf(props.tomorrow);
  const [typed, setTyped] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function lock() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await forge(props.tomorrow.date);
      if (res.length > 0) return void setProblems(res.map((p) => FORGE_PROBLEM_COPY[p]));
      await setDayFlag(addDays(props.tomorrow.date, -1), "closed");
      tapDone();
      props.onForged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={s.heading}>Tomorrow</Text>
      {slots.P1 ? (
        <View style={s.p1}>
          <Text style={s.p1Tag}>P1</Text>
          <Text style={s.p1Title}>{slots.P1.title}</Text>
          <Text style={s.p1Line}>Minimum · {slots.P1.minimum}</Text>
          <Text style={s.p1Line}>If-then · {slots.P1.ifThen}</Text>
        </View>
      ) : (
        <Text style={s.body}>No P1 yet.</Text>
      )}
      {AFTER_P1.map((sl) =>
        slots[sl] ? (
          <Text key={sl} style={s.body}>
            {SLOT_LABEL[sl]} · {slots[sl]?.title}
          </Text>
        ) : null,
      )}

      {problems.length > 0 ? (
        <View accessibilityRole="alert" style={s.group}>
          {problems.map((p) => (
            <Text key={p} style={s.body}>
              {p}
            </Text>
          ))}
          <BigButton label="Back to Pick missions" variant="secondary" onPress={props.onFixPlan} />
        </View>
      ) : null}

      <HoldButton label="Hold to lock tomorrow" onComplete={() => void lock()} disabled={busy} />
      <TextField
        label="…or type “done” to lock it"
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => typed.trim().toLowerCase() === "done" && void lock()}
        returnKeyType="done"
      />
      <BigButton label="Lock tomorrow" variant="secondary" disabled={typed.trim().toLowerCase() !== "done" || busy} onPress={() => void lock()} />
      <BigButton label="Back" variant="quiet" size="compact" onPress={props.onBack} />
    </>
  );
}

/** Press and hold for `holdMs` (default 1.5 s). The fill is state, so progress shows even with reduced motion. */
function HoldButton(props: { label: string; onComplete: () => void; disabled?: boolean; holdMs?: number; text?: string }) {
  const s = useStyles(makeStyles);
  const holdMs = props.holdMs ?? 1500;
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    startRef.current = null;
    setProgress(0);
  }, []);

  const start = () => {
    if (props.disabled || startRef.current !== null) return;
    startRef.current = Date.now();
    timer.current = setInterval(() => {
      const t0 = startRef.current;
      if (t0 === null) return;
      const p = Math.min(1, (Date.now() - t0) / holdMs);
      setProgress(p);
      if (p >= 1) {
        stop();
        props.onComplete();
      }
    }, 30);
  };

  useEffect(() => stop, [stop]);

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={`Press and hold for ${holdMs / 1000} seconds`}
      accessibilityState={{ disabled: props.disabled === true }}
      style={[s.hold, props.disabled && s.holdOff]}
    >
      <View style={[s.holdFill, { width: `${progress * 100}%` }]} />
      <Text style={s.holdText}>{props.text ?? props.label}</Text>
    </Pressable>
  );
}

// ---------- shutdown complete + restart ----------

function ShutdownComplete({ fresh, date, onRestarted }: { fresh: boolean; date: ISODate; onRestarted: () => void }) {
  const s = useStyles(makeStyles);
  const [restarting, setRestarting] = useState(false);
  return (
    <Screen sheet>
      <SheetHeader title="Night ritual" onClose={() => router.back()} />
      <Text style={s.hero}>Shutdown complete.</Text>
      <Text style={s.big}>Phone outside the room.</Text>
      <Text style={s.body}>{fresh ? "Tomorrow is locked. Sleep well." : "Tomorrow is already locked. Changing it needs a reason, from Today."}</Text>
      <Kural n={664} />
      <BigButton label="Back to Today" variant="secondary" onPress={() => router.back()} />
      {restarting ? (
        <RestartFlow
          date={date}
          onClose={() => setRestarting(false)}
          onRestarted={() => {
            setRestarting(false);
            onRestarted();
          }}
        />
      ) : (
        <BigButton label="Restart the ritual…" variant="quiet" size="compact" onPress={() => setRestarting(true)} />
      )}
    </Screen>
  );
}

type RestartStage = "why" | "wait" | "confirm";

const RESTART_TEXT: Record<Exclude<RestartOutcome, "ok">, string> = {
  offline: "Restarting needs a connection.",
  used: "This plan was already restarted once. Keep it, or change single missions with a reason.",
  limit: `The ritual can be restarted ${RITUAL_RESTART.perWeek} times in 7 days. Keep this plan.`,
  failed: "That didn't work. Your plan is still locked.",
};

/**
 * Restarting unlocks tomorrow's plan. Deliberately slow, like the website: a written reason, a pause, typing the
 * word, then a hold. "Keep my plan" is the primary button throughout. The server allows it once per plan.
 */
function RestartFlow(props: { date: ISODate; onClose: () => void; onRestarted: () => void }) {
  const s = useStyles(makeStyles);
  const [stage, setStage] = useState<RestartStage>("why");
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const [wait, setWait] = useState<number>(RITUAL_RESTART.waitSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chars = reason.trim().length;

  useEffect(() => {
    if (stage !== "wait" || wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, wait]);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const out = await restartRitual(props.date, reason);
      if (out === "ok") {
        tapDone();
        props.onRestarted();
      } else setError(RESTART_TEXT[out]);
    } finally {
      setBusy(false);
    }
  }

  const keep = <BigButton label="Keep my plan" variant="primary" onPress={props.onClose} />;
  return (
    <Card tone="surface">
      <Text style={s.heading}>Restart the night ritual?</Text>
      <Text style={s.small}>Your plan is locked so tomorrow-you can trust it. Step {stage === "why" ? 1 : stage === "wait" ? 2 : 3} of 3.</Text>
      {stage === "why" ? (
        <>
          <Kural n={467} meaning={false} />
          <Text style={s.small}>
            Restarting unlocks tomorrow so you can plan it again. It works once per plan and {RITUAL_RESTART.perWeek} times a week, and the reason shows in Sunday's review.
            To change one mission, edit it from Today instead.
          </Text>
          <TextField label="What changed since you locked it?" value={reason} onChangeText={setReason} multiline maxLength={250} />
          <Text style={s.small}>{chars < RITUAL_RESTART.minReason ? `${RITUAL_RESTART.minReason - chars} more characters` : "Thanks. That's honest enough."}</Text>
          {keep}
          <BigButton label="Continue" variant="quiet" size="compact" disabled={chars < RITUAL_RESTART.minReason} onPress={() => setStage("wait")} />
        </>
      ) : null}
      {stage === "wait" ? (
        <>
          <Text style={s.big}>Sit with it for a moment.</Text>
          <Text style={s.small}>You made this plan with a clear head. If it still feels wrong in {RITUAL_RESTART.waitSeconds} seconds, go on.</Text>
          <Text style={s.hero} accessibilityRole="timer">
            {wait > 0 ? `0:${String(wait).padStart(2, "0")}` : "0:00"}
          </Text>
          {keep}
          <BigButton label={wait > 0 ? "Wait…" : "Continue"} variant="quiet" size="compact" disabled={wait > 0} onPress={() => setStage("confirm")} />
        </>
      ) : null}
      {stage === "confirm" ? (
        <>
          <TextField label={`Type ${RITUAL_RESTART.word} to unlock tomorrow`} value={word} onChangeText={setWord} autoCapitalize="none" autoCorrect={false} />
          <HoldButton
            label="Hold to unlock tomorrow"
            text={busy ? "Unlocking…" : "Hold to unlock tomorrow"}
            holdMs={RITUAL_RESTART.holdMs}
            disabled={busy || word.trim().toLowerCase() !== RITUAL_RESTART.word}
            onComplete={() => void unlock()}
          />
          {error ? (
            <Text accessibilityRole="alert" style={s.body}>
              {error}
            </Text>
          ) : null}
          {keep}
        </>
      ) : null}
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(400, 16, 24), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink },
    heading: { ...f(600, 17, 24), color: c.ink },
    stepTitle: { ...f(600, 24, 30), color: c.ink },
    slot: { ...f(600, 13, 18), color: c.ink2 },
    cardTitle: { ...f(600, 16, 22), color: c.ink },
    hero: { ...f(600, 34, 40), color: c.ink },
    big: { ...f(500, 20, 28), color: c.ink },
    group: { gap: space(1) },
    flex: { flex: 1 },
    quiet: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: space(2) },
    quietText: { ...f(500, 14, 20), color: c.ink2, textDecorationLine: "underline" },
    dots: { flexDirection: "row", gap: 6, alignItems: "center", minHeight: 24 },
    dot: { height: 10, borderRadius: 5 },
    dotNow: { width: 32, backgroundColor: c.lime },
    dotDone: { width: 10, backgroundColor: c.ink },
    dotTodo: { width: 10, borderWidth: 1.5, borderColor: c.ink2 },
    actions: { gap: space(1), marginTop: space(1) },
    actionsRow: { flexDirection: "row", gap: space(1) },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2, maxWidth: "100%" },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
    anchor: { flexDirection: "row", alignItems: "center", gap: space(1), backgroundColor: c.surface2, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: space(2), paddingRight: 6 },
    anchorName: { ...f(600, 14, 20), color: c.ink },
    anchorTime: { ...f(600, 12, 16), color: c.onHero, backgroundColor: c.hero, borderRadius: radius.pill, paddingHorizontal: space(1.25), paddingVertical: 4, overflow: "hidden", fontVariant: ["tabular-nums"] },
    bigInput: { ...f(600, 36, 42), minWidth: 110, textAlign: "center", paddingVertical: 0, fontVariant: ["tabular-nums"] },
    slotHead: { flexDirection: "row", alignItems: "center", gap: space(1) },
    pill: { backgroundColor: c.surface2, borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: 4 },
    pillP1: { backgroundColor: c.lime },
    pillText: { ...f(700, 13, 18), color: c.ink },
    pick: { minHeight: 44, justifyContent: "center", paddingVertical: space(1), paddingHorizontal: space(1.5), borderRadius: radius.inner, backgroundColor: c.surface2 },
    points: { ...f(600, 16, 22), color: c.ink, minWidth: 90, textAlign: "center" },
    p1: { backgroundColor: c.hero, borderRadius: radius.card, padding: space(2.5), gap: space(0.75) },
    p1Tag: { ...f(700, 13, 18), color: c.onHero },
    p1Title: { ...f(600, 22, 28), color: c.onHero },
    p1Line: { ...f(500, 14, 20), color: c.onHero },
    hold: { minHeight: 64, borderRadius: radius.pill, backgroundColor: c.surface2, justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 2, borderColor: c.lime },
    holdOff: { opacity: 0.5 },
    holdFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: c.lime },
    holdText: { ...f(600, 17, 24), color: c.ink },
  });
