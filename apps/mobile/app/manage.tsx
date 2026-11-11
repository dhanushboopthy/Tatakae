import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { DEFAULT_SCORING, addDays, canEditScoring, type Anchor, type Area, type Habit, type ScoringSettings, type WatchQueueItem } from "@tatakae/core";
import { useAreas, useSettings, useToday, useRecharge } from "../src/lib/hooks";
import { useAnchors } from "../src/lib/planning";
import { useWatchQueue } from "../src/lib/reviews";
import { removeAnchor, removeArea, removeHabit, removeRecharge, removeWatch, saveAnchor, saveArea, saveHabit, saveRecharge, saveScoring, saveWatch, useAllHabits } from "../src/lib/manage";
import { AREA_COLORS, type AreaColorKey } from "../src/lib/colors";
import { longDate, shiftHHMM } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { Stepper } from "../src/components/fitnessUi";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useStyles, type Theme } from "../src/lib/theme";

// The settings the website has and the phone's Settings tab doesn't: anchors, habits, areas, the recharge menu, the
// reward queue and the scoring constants. Everything syncs through the outbox and works offline.

type Section = "anchors" | "habits" | "areas" | "recharge" | "reward" | "scoring";
const SECTIONS: readonly { value: Section; label: string }[] = [
  { value: "anchors", label: "Anchors" },
  { value: "habits", label: "Habits" },
  { value: "areas", label: "Areas" },
  { value: "recharge", label: "Recharge" },
  { value: "reward", label: "Reward queue" },
  { value: "scoring", label: "Scoring" },
];

export default function Manage() {
  const s = useStyles(makeStyles);
  const [section, setSection] = useState<Section>("anchors");
  return (
    <Screen sheet>
      <SheetHeader title="More settings" onClose={() => router.back()} />
      <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Section">
        {SECTIONS.map((x) => (
          <Chip key={x.value} label={x.label} on={section === x.value} onPress={() => setSection(x.value)} radio />
        ))}
      </View>
      {section === "anchors" ? <Anchors /> : null}
      {section === "habits" ? <Habits /> : null}
      {section === "areas" ? <Areas /> : null}
      {section === "recharge" ? <Recharge /> : null}
      {section === "reward" ? <Reward /> : null}
      {section === "scoring" ? <Scoring /> : null}
    </Screen>
  );
}

function Chip({ label, on, onPress, radio }: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityState={radio ? { checked: on } : { selected: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && pressedStyle]}
    >
      <Text style={s.chipText}>
        {on ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

function Block(props: { title: string; note?: string; children: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <Card tone="surface">
      <Text style={s.heading}>{props.title}</Text>
      {props.note ? <Text style={s.small}>{props.note}</Text> : null}
      {props.children}
    </Card>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.group}>
      <Text style={s.label}>{label}</Text>
      <Stepper
        minusLabel={`${label}: 15 minutes earlier`}
        plusLabel={`${label}: 15 minutes later`}
        onMinus={() => onChange(shiftHHMM(value, -15))}
        onPlus={() => onChange(shiftHHMM(value, 15))}
        value={<Text style={s.time}>{value}</Text>}
      />
    </View>
  );
}

// ---------- anchors ----------

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function Anchors() {
  const s = useStyles(makeStyles);
  const { data: anchors = [] } = useAnchors();
  const [editing, setEditing] = useState<Anchor | "new" | null>(null);
  return (
    <Block title="Anchors" note="Fixed commitments (classes, internship, gym). They come off the free minutes the night ritual plans with.">
      {editing ? (
        <AnchorForm anchor={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <>
          {anchors.length === 0 ? <Text style={s.small}>No anchors yet.</Text> : null}
          {anchors.map((a) => (
            <Row key={a.id} title={a.name} sub={`${a.startTime}–${a.endTime} · ${weekdaysText(a.weekdays)}`} onEdit={() => setEditing(a)} />
          ))}
          <BigButton label="Add anchor" variant="secondary" onPress={() => setEditing("new")} />
        </>
      )}
    </Block>
  );
}

const weekdaysText = (w: string): string => (w.trim() === "" ? "every day" : w.split(",").map((d) => DAYS[Number(d)] ?? d).join(", "));

function AnchorForm({ anchor, onDone }: { anchor: Anchor | null; onDone: () => void }) {
  const [name, setName] = useState(anchor?.name ?? "");
  const [start, setStart] = useState(anchor?.startTime ?? "09:00");
  const [end, setEnd] = useState(anchor?.endTime ?? "10:00");
  const [days, setDays] = useState<Set<number>>(new Set((anchor?.weekdays ?? "").split(",").filter(Boolean).map(Number)));
  const s = useStyles(makeStyles);
  const toggle = (d: number) =>
    setDays((cur) => {
      const next = new Set(cur);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  return (
    <>
      <TextField label="Name" value={name} onChangeText={setName} maxLength={100} />
      <TimeField label="Starts" value={start} onChange={setStart} />
      <TimeField label="Ends" value={end} onChange={setEnd} />
      <View style={s.group}>
        <Text style={s.label}>Days</Text>
        <View style={s.chips}>
          {DAYS.map((d, i) => (
            <Chip key={d} label={d} on={days.has(i)} onPress={() => toggle(i)} />
          ))}
        </View>
        <Text style={s.small}>None picked means every day.</Text>
      </View>
      <BigButton
        label="Save anchor"
        variant="accent"
        disabled={!name.trim()}
        onPress={async () => {
          await saveAnchor({ id: anchor?.id, name: name.trim(), startTime: start, endTime: end, weekdays: [...days].sort().join(",") });
          tapDone();
          onDone();
        }}
      />
      {anchor ? (
        <BigButton
          label="Delete anchor"
          variant="quiet"
          size="compact"
          onPress={async () => {
            await removeAnchor(anchor.id);
            onDone();
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </>
  );
}

function Row({ title, sub, onEdit }: { title: string; sub?: string; onEdit: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.row}>
      <View style={s.flex}>
        <Text style={s.body}>{title}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
      </View>
      <BigButton label="Edit" variant="secondary" size="compact" onPress={onEdit} accessibilityLabel={`Edit ${title}`} />
    </View>
  );
}

// ---------- habits ----------

const FREQUENCIES = ["daily", "weekdays"] as const;

function Habits() {
  const s = useStyles(makeStyles);
  const { data: habits = [] } = useAllHabits();
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  return (
    <Block title="Habits" note="Tracked, never scored. After <anchor> I <behaviour>.">
      {editing ? (
        <HabitForm habit={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <>
          {habits.length === 0 ? <Text style={s.small}>No habits yet.</Text> : null}
          {habits.map((h) => (
            <Row key={h.id} title={h.behaviour} sub={`${h.frequency}${h.active ? "" : " · paused"}${h.anchor ? ` · after ${h.anchor}` : ""}`} onEdit={() => setEditing(h)} />
          ))}
          <BigButton label="Add habit" variant="secondary" onPress={() => setEditing("new")} />
        </>
      )}
    </Block>
  );
}

function HabitForm({ habit, onDone }: { habit: Habit | null; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const { data: areas = [] } = useAreas();
  const [behaviour, setBehaviour] = useState(habit?.behaviour ?? "");
  const [anchor, setAnchor] = useState(habit?.anchor ?? "");
  const [minimum, setMinimum] = useState(habit?.minimum ?? "");
  const [frequency, setFrequency] = useState(habit?.frequency ?? "daily");
  const [active, setActive] = useState(habit?.active ?? true);
  const [areaId, setAreaId] = useState<string | null>(habit?.areaId ?? null);
  return (
    <>
      <TextField label="Behaviour" value={behaviour} onChangeText={setBehaviour} maxLength={200} placeholder="stretch for five minutes" />
      <TextField label="After I…" value={anchor} onChangeText={setAnchor} maxLength={200} placeholder="brush my teeth" />
      <TextField label="Smallest version" value={minimum} onChangeText={setMinimum} maxLength={200} />
      <View style={s.group}>
        <Text style={s.label}>How often</Text>
        <View style={s.chips}>
          {FREQUENCIES.map((x) => (
            <Chip key={x} label={x === "daily" ? "Daily" : "Weekdays"} on={frequency === x} onPress={() => setFrequency(x)} />
          ))}
        </View>
      </View>
      <View style={s.group}>
        <Text style={s.label}>Area</Text>
        <View style={s.chips}>
          <Chip label="None" on={areaId === null} onPress={() => setAreaId(null)} />
          {areas.map((a) => (
            <Chip key={a.id} label={a.name} on={areaId === a.id} onPress={() => setAreaId(a.id)} />
          ))}
        </View>
      </View>
      <Chip label={active ? "Active" : "Paused"} on={active} onPress={() => setActive((v) => !v)} />
      <BigButton
        label="Save habit"
        variant="accent"
        disabled={!behaviour.trim()}
        onPress={async () => {
          await saveHabit({ id: habit?.id, behaviour: behaviour.trim(), anchor: anchor.trim() || null, minimum: minimum.trim() || null, frequency, areaId, active });
          tapDone();
          onDone();
        }}
      />
      {habit ? (
        <BigButton
          label="Delete habit"
          variant="quiet"
          size="compact"
          onPress={async () => {
            await removeHabit(habit.id);
            onDone();
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </>
  );
}

// ---------- areas ----------

function Areas() {
  const s = useStyles(makeStyles);
  const { data: areas = [] } = useAreas();
  const [editing, setEditing] = useState<Area | "new" | null>(null);
  return (
    <Block title="Areas" note="Life areas with a why. Their colour tints goal rings and focus charts.">
      {editing ? (
        <AreaForm area={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <>
          {areas.length === 0 ? <Text style={s.small}>No areas yet. Try Career, Health, Japanese, Freelance.</Text> : null}
          {areas.map((a) => (
            <Row key={a.id} title={a.name} sub={a.why ?? undefined} onEdit={() => setEditing(a)} />
          ))}
          <BigButton label="Add area" variant="secondary" onPress={() => setEditing("new")} />
        </>
      )}
    </Block>
  );
}

function AreaForm({ area, onDone }: { area: Area | null; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const [name, setName] = useState(area?.name ?? "");
  const [standard, setStandard] = useState(area?.standard ?? "");
  const [why, setWhy] = useState(area?.why ?? "");
  const [color, setColor] = useState<string | null>(area?.color ?? null);
  return (
    <>
      <TextField label="Name" value={name} onChangeText={setName} maxLength={100} />
      <TextField label="Standard" value={standard} onChangeText={setStandard} maxLength={300} />
      <TextField label="Why" value={why} onChangeText={setWhy} maxLength={500} multiline />
      <View style={s.group}>
        <Text style={s.label}>Colour</Text>
        <View style={s.chips}>
          <Chip label="Automatic" on={color === null} onPress={() => setColor(null)} />
          {(Object.keys(AREA_COLORS) as AreaColorKey[]).map((k) => (
            <Chip key={k} label={k} on={color === k} onPress={() => setColor(k)} />
          ))}
        </View>
      </View>
      <BigButton
        label="Save area"
        variant="accent"
        disabled={!name.trim()}
        onPress={async () => {
          await saveArea({ ...(area ?? {}), id: area?.id, name: name.trim(), standard: standard.trim() || null, why: why.trim() || null, color });
          tapDone();
          onDone();
        }}
      />
      {area ? (
        <BigButton
          label="Delete area"
          variant="quiet"
          size="compact"
          onPress={async () => {
            await removeArea(area.id);
            onDone();
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </>
  );
}

// ---------- recharge ----------

function Recharge() {
  const s = useStyles(makeStyles);
  const { data: items = [] } = useRecharge();
  const [name, setName] = useState("");
  return (
    <Block title="Recharge menu" note="What to do after a focus block: walk, music, call, stretch, sketch…">
      {items.map((r) => (
        <View key={r.id} style={s.row}>
          <Text style={[s.body, s.flex]}>{r.name}</Text>
          <BigButton label="Remove" variant="quiet" size="compact" onPress={() => void removeRecharge(r.id)} accessibilityLabel={`Remove ${r.name}`} />
        </View>
      ))}
      <TextField label="Add an item" value={name} onChangeText={setName} maxLength={60} />
      <BigButton
        label="Add"
        variant="secondary"
        disabled={!name.trim()}
        onPress={async () => {
          await saveRecharge({ name });
          tapDone();
          setName("");
        }}
      />
    </Block>
  );
}

// ---------- reward queue ----------

function Reward() {
  const s = useStyles(makeStyles);
  const { data: items = [] } = useWatchQueue();
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const bump = (w: WatchQueueItem, patch: Partial<WatchQueueItem>) => void saveWatch({ ...w, ...patch });
  return (
    <Block title="Reward queue" note="Each completed weekly review unlocks one episode of the next show. A light nudge, not a currency.">
      {items.map((w) => (
        <View key={w.title} style={s.group}>
          <Text style={s.body}>{w.title}</Text>
          <Text style={s.small}>
            {w.watched}/{w.totalEpisodes ?? "?"} watched · {Math.max(0, w.unlocked - w.watched)} unlocked
          </Text>
          <View style={s.rowBtns}>
            <BigButton
              label="Watched one"
              variant="secondary"
              size="compact"
              disabled={w.unlocked <= w.watched}
              onPress={() => bump(w, { watched: w.watched + 1, status: w.totalEpisodes && w.watched + 1 >= w.totalEpisodes ? "done" : "watching" })}
              style={s.flex}
            />
            <BigButton label="Remove" variant="quiet" size="compact" onPress={() => void removeWatch(w.title)} accessibilityLabel={`Remove ${w.title}`} style={s.flex} />
          </View>
        </View>
      ))}
      <TextField label="Show title" value={title} onChangeText={setTitle} maxLength={200} />
      <TextField label="Episodes (optional)" value={total} onChangeText={(v) => setTotal(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={4} />
      <BigButton
        label="Add to the queue"
        variant="secondary"
        disabled={!title.trim() || items.some((i) => i.title === title.trim())}
        onPress={async () => {
          const n = Number.parseInt(total, 10);
          await saveWatch({ title: title.trim(), totalEpisodes: Number.isFinite(n) && n > 0 ? n : null, watched: 0, unlocked: 0, status: "queued" });
          tapDone();
          setTitle("");
          setTotal("");
        }}
      />
    </Block>
  );
}

// ---------- scoring ----------

const FIELDS: readonly { key: keyof ScoringSettings; label: string; hint: string }[] = [
  { key: "strongAt", label: "Strong at", hint: "final ≥ this" },
  { key: "solidAt", label: "Solid at", hint: "final ≥ this" },
  { key: "missedExecBelow", label: "Missed day below", hint: "execution %" },
  { key: "screenFreeMin", label: "Free screen minutes", hint: "no penalty up to" },
  { key: "screenStepMin", label: "Penalty step", hint: "minutes per step" },
  { key: "screenStepPenalty", label: "Penalty per step", hint: "points" },
  { key: "screenPenaltyCap", label: "Penalty cap", hint: "points" },
  { key: "comebackBonus", label: "Comeback bonus", hint: "points" },
  { key: "capacityRatio", label: "Capacity line", hint: "share of free time, 0–1" },
  { key: "writeOffsPerMonth", label: "Write-offs a month", hint: "days" },
];

function nextEditable(today: string): string {
  for (let i = 0; i < 21; i++) {
    const d = addDays(today, i);
    if (canEditScoring(d)) return d;
  }
  return today;
}

function Scoring() {
  const s = useStyles(makeStyles);
  const { data: settings } = useSettings();
  const today = useToday();
  const editable = canEditScoring(today);
  if (!settings) return null;
  return (
    <Block
      title="Scoring"
      note={editable ? "It's an even-week Sunday: you can change the constants today." : `Editable on even-week Sundays. Next: ${longDate(nextEditable(today))}.`}
    >
      <ScoringForm key={JSON.stringify(settings.scoring)} value={settings.scoring} editable={editable} />
      {!editable ? <Text style={s.small}>This guard keeps the rules from being changed mid-week.</Text> : null}
    </Block>
  );
}

function ScoringForm({ value, editable }: { value: ScoringSettings; editable: boolean }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((x) => [x.key, String(value[x.key])])));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      {FIELDS.map((x) => (
        <TextField
          key={x.key}
          label={`${x.label} · ${x.hint}`}
          value={draft[x.key] ?? ""}
          onChangeText={(v) => setDraft((d) => ({ ...d, [x.key]: v.replace(/[^0-9.]/g, "") }))}
          keyboardType="decimal-pad"
          editable={editable}
          maxLength={6}
        />
      ))}
      {editable ? (
        <>
          <BigButton
            label="Save scoring"
            variant="accent"
            onPress={async () => {
              const next: Partial<ScoringSettings> = {};
              for (const x of FIELDS) {
                const n = Number(draft[x.key]);
                if (Number.isFinite(n) && n >= 0) next[x.key] = n;
              }
              await saveScoring({ ...value, ...next });
              tapDone();
              setMsg("Scoring saved.");
            }}
          />
          <BigButton
            label="Reset to defaults"
            variant="quiet"
            size="compact"
            onPress={() => setDraft(Object.fromEntries(FIELDS.map((x) => [x.key, String(DEFAULT_SCORING[x.key])])))}
          />
        </>
      ) : null}
      {msg ? <Text accessibilityRole="alert">{msg}</Text> : null}
    </>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink2 },
    heading: { ...f(600, 17, 24), color: c.ink },
    time: { ...f(600, 20, 28), color: c.ink, minWidth: 90, textAlign: "center", fontVariant: ["tabular-nums"] },
    flex: { flex: 1 },
    group: { gap: space(0.75) },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2 },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
    row: { flexDirection: "row", alignItems: "center", gap: space(1.5), paddingVertical: space(0.5) },
    rowBtns: { flexDirection: "row", gap: space(1) },
  });
