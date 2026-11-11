import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  isHttpUrl,
  normalizeTags,
  weekdayOf,
  type Application,
  type ApplicationStatus,
  type ISODate,
  type InterviewStory,
  type JapaneseKind,
  type JapaneseLogEntry,
} from "@tatakae/core";
import { useToday } from "../src/lib/hooks";
import { useGoals } from "../src/lib/planning";
import { applicationsApi, japaneseApi, restErrorText, storiesApi } from "../src/lib/rest";
import { longDate, shortDate } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { DateStepper } from "../src/components/DateStepper";
import { SegmentedPills } from "../src/components/SegmentedPills";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { tapDone, tapLight } from "../src/haptics";
import { f, radius, space } from "../src/theme";
import { pressedStyle, useStyles, type Theme } from "../src/lib/theme";

// Library (website: Library tabs): job applications, interview stories (STAR) and the Japanese practice log. These are
// REST only (not synced), so they need a connection and say so calmly.

type Tab = "applications" | "stories" | "japanese";

export default function Library() {
  const [tab, setTab] = useState<Tab>("applications");
  return (
    <Screen sheet>
      <SheetHeader title="Library" subtitle="Needs a connection" onClose={() => router.back()} />
      <SegmentedPills
        accessibilityLabel="Library"
        value={tab}
        onChange={setTab}
        options={[
          { value: "applications", label: "Applications" },
          { value: "stories", label: "Stories" },
          { value: "japanese", label: "Japanese" },
        ]}
        stretch
      />
      {tab === "applications" ? <Applications /> : null}
      {tab === "stories" ? <Stories /> : null}
      {tab === "japanese" ? <Japanese /> : null}
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && pressedStyle]}
    >
      <Text style={s.chipText}>
        {on ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

function ErrorLine({ list, what }: { list: { isError: boolean; error: unknown }; what: string }) {
  const s = useStyles(makeStyles);
  return list.isError ? <Text style={s.body}>{restErrorText(list.error, what)}</Text> : null;
}

/** A date you can leave empty: "Set a date" starts a stepper, "Clear" empties it again. */
function OptionalDate(props: { label: string; value: ISODate | null; onChange: (d: ISODate | null) => void; startAt: ISODate }) {
  const s = useStyles(makeStyles);
  if (props.value == null) {
    return (
      <View style={s.group}>
        <Text style={s.label}>{props.label}</Text>
        <BigButton label="Set a date" variant="secondary" size="compact" onPress={() => props.onChange(props.startAt)} accessibilityLabel={`${props.label}: set a date`} />
      </View>
    );
  }
  return (
    <View style={s.group}>
      <DateStepper label={props.label} value={props.value} onChange={props.onChange} />
      <BigButton label="Clear the date" variant="quiet" size="compact" onPress={() => props.onChange(null)} />
    </View>
  );
}

// ---------- applications ----------

const STATUS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Not this time",
  withdrawn: "Withdrawn",
};
const STATUSES = Object.keys(STATUS) as ApplicationStatus[];
const isOpen = (a: Application) => a.status !== "rejected" && a.status !== "withdrawn";

function Applications() {
  const s = useStyles(makeStyles);
  const today = useToday();
  const list = applicationsApi.useList();
  const [editing, setEditing] = useState<Application | "new" | null>(null);
  const items = list.data ?? [];
  if (editing) return <ApplicationForm app={editing === "new" ? null : editing} today={today} onDone={() => setEditing(null)} />;
  const open = items.filter(isOpen);
  const closed = items.filter((a) => !isOpen(a));
  return (
    <>
      <BigButton label="Add application" variant="accent" onPress={() => setEditing("new")} />
      <ErrorLine list={list} what="Applications" />
      {items.length === 0 && !list.isError ? <Text style={s.small}>{list.isLoading ? "Opening…" : "No applications yet. Track each one with its next step, so nothing waits on memory."}</Text> : null}
      {open.map((a) => (
        <AppCard key={a.id} app={a} today={today} onEdit={() => setEditing(a)} />
      ))}
      {closed.length > 0 ? <Text style={s.section}>Closed ({closed.length})</Text> : null}
      {closed.map((a) => (
        <AppCard key={a.id} app={a} today={today} onEdit={() => setEditing(a)} />
      ))}
    </>
  );
}

function AppCard({ app, today, onEdit }: { app: Application; today: ISODate; onEdit: () => void }) {
  const s = useStyles(makeStyles);
  const due = app.nextStepOn != null && app.nextStepOn <= today && isOpen(app);
  return (
    <Card tone="surface">
      <View style={s.between}>
        <View style={s.flex}>
          <Text style={s.title}>{app.company}</Text>
          <Text style={s.small}>{app.role}</Text>
        </View>
        <View style={s.pill}>
          <Text style={s.pillText}>{STATUS[app.status]}</Text>
        </View>
      </View>
      {app.nextStep ? (
        <Text style={s.body}>
          Next: {app.nextStep}
          {app.nextStepOn ? ` · ${shortDate(app.nextStepOn)}${due ? " (due)" : ""}` : ""}
        </Text>
      ) : null}
      {app.appliedOn ? <Text style={s.small}>Applied {longDate(app.appliedOn)}</Text> : null}
      <BigButton label="Edit" variant="secondary" size="compact" onPress={onEdit} accessibilityLabel={`Edit ${app.company}`} />
    </Card>
  );
}

function ApplicationForm({ app, today, onDone }: { app: Application | null; today: ISODate; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const qc = useQueryClient();
  const [f2, setF] = useState({
    company: app?.company ?? "",
    role: app?.role ?? "",
    nextStep: app?.nextStep ?? "",
    url: app?.url ?? "",
    source: app?.source ?? "",
    notes: app?.notes ?? "",
  });
  const [status, setStatus] = useState<ApplicationStatus>(app?.status ?? "wishlist");
  const [appliedOn, setAppliedOn] = useState<ISODate | null>(app?.appliedOn ?? null);
  const [nextStepOn, setNextStepOn] = useState<ISODate | null>(app?.nextStepOn ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f2) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (busy) return;
    if (!f2.company.trim() || !f2.role.trim()) return void setProblem("Add the company and the role.");
    if (f2.url.trim() && !isHttpUrl(f2.url.trim())) return void setProblem("The posting link should start with https://.");
    setBusy(true);
    try {
      const n = (v: string) => v.trim() || null;
      const body = { company: f2.company.trim(), role: f2.role.trim(), status, appliedOn, nextStep: n(f2.nextStep), nextStepOn, url: n(f2.url), source: n(f2.source), notes: n(f2.notes) };
      if (app) await applicationsApi.update(qc, app.id, body);
      else await applicationsApi.create(qc, body);
      tapDone();
      onDone();
    } catch (e) {
      setProblem(restErrorText(e, "Saving"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="surface">
      <Text style={s.heading}>{app ? "Edit application" : "Add application"}</Text>
      <TextField label="Company" value={f2.company} onChangeText={set("company")} maxLength={200} />
      <TextField label="Role" value={f2.role} onChangeText={set("role")} maxLength={200} />
      <View style={s.group}>
        <Text style={s.label}>Status</Text>
        <View style={s.chips}>
          {STATUSES.map((x) => (
            <Chip key={x} label={STATUS[x]} on={status === x} onPress={() => setStatus(x)} />
          ))}
        </View>
      </View>
      <OptionalDate label="Applied on" value={appliedOn} onChange={setAppliedOn} startAt={today} />
      <TextField label="Next step" value={f2.nextStep} onChangeText={set("nextStep")} maxLength={300} placeholder="Follow up with the recruiter" />
      <OptionalDate label="Next step on" value={nextStepOn} onChange={setNextStepOn} startAt={today} />
      <TextField label="Posting link" value={f2.url} onChangeText={set("url")} maxLength={500} autoCapitalize="none" keyboardType="url" placeholder="https://" />
      <TextField label="Source" value={f2.source} onChangeText={set("source")} maxLength={100} placeholder="Referral, LinkedIn…" />
      <TextField label="Notes" value={f2.notes} onChangeText={set("notes")} multiline maxLength={5000} />
      {problem ? (
        <Text accessibilityRole="alert" style={s.body}>
          {problem}
        </Text>
      ) : null}
      <BigButton label="Save" variant="accent" busy={busy} onPress={() => void save()} />
      {app ? (
        <BigButton
          label="Delete application"
          variant="quiet"
          size="compact"
          onPress={async () => {
            try {
              await applicationsApi.remove(qc, app.id);
              onDone();
            } catch (e) {
              setProblem(restErrorText(e, "Deleting"));
            }
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </Card>
  );
}

// ---------- stories ----------

const PARTS = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

function Stories() {
  const s = useStyles(makeStyles);
  const list = storiesApi.useList();
  const { data: goals = [] } = useGoals();
  const [editing, setEditing] = useState<InterviewStory | "new" | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const items = list.data ?? [];
  if (editing) return <StoryForm story={editing === "new" ? null : editing} onDone={() => setEditing(null)} />;
  const tags = [...new Set(items.flatMap((x) => x.tags))].sort();
  const shown = tag ? items.filter((x) => x.tags.includes(tag)) : items;
  return (
    <>
      <BigButton label="Add story" variant="accent" onPress={() => setEditing("new")} />
      <ErrorLine list={list} what="Stories" />
      {tags.length > 0 ? (
        <View style={s.chips}>
          <Chip label="All" on={tag === null} onPress={() => setTag(null)} />
          {tags.map((t) => (
            <Chip key={t} label={t} on={tag === t} onPress={() => setTag(tag === t ? null : t)} />
          ))}
        </View>
      ) : null}
      {items.length === 0 && !list.isError ? <Text style={s.small}>{list.isLoading ? "Opening…" : "No stories yet. Keep a few in Situation, Task, Action, Result form."}</Text> : null}
      {shown.map((st) => (
        <Card key={st.id} tone="surface">
          <Text style={s.title}>{st.title}</Text>
          {st.goalId ? <Text style={s.small}>{goals.find((g) => g.id === st.goalId)?.name ?? "Goal"}</Text> : null}
          {st.result && open !== st.id ? <Text style={s.body}>Result: {st.result}</Text> : null}
          {open === st.id
            ? PARTS.map(([k, label]) => (st[k] ? <Text key={k} style={s.body}>{label}: {st[k]}</Text> : null))
            : null}
          {st.tags.length > 0 ? <Text style={s.small}>{st.tags.join(" · ")}</Text> : null}
          <View style={s.rowBtns}>
            <BigButton label={open === st.id ? "Hide" : "Read"} variant="secondary" size="compact" onPress={() => setOpen(open === st.id ? null : st.id)} style={s.flex} />
            <BigButton label="Edit" variant="secondary" size="compact" onPress={() => setEditing(st)} accessibilityLabel={`Edit ${st.title}`} style={s.flex} />
          </View>
        </Card>
      ))}
    </>
  );
}

function StoryForm({ story, onDone }: { story: InterviewStory | null; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const qc = useQueryClient();
  const { data: goals = [] } = useGoals();
  const [title, setTitle] = useState(story?.title ?? "");
  const [parts, setParts] = useState({ situation: story?.situation ?? "", task: story?.task ?? "", action: story?.action ?? "", result: story?.result ?? "" });
  const [tags, setTags] = useState(story?.tags.join(", ") ?? "");
  const [goalId, setGoalId] = useState<string | null>(story?.goalId ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (!title.trim()) return void setProblem("Give the story a title.");
    setBusy(true);
    try {
      const n = (v: string) => v.trim() || null;
      const body = { title: title.trim(), situation: n(parts.situation), task: n(parts.task), action: n(parts.action), result: n(parts.result), tags: normalizeTags(tags.split(",")), goalId };
      if (story) await storiesApi.update(qc, story.id, body);
      else await storiesApi.create(qc, body);
      tapDone();
      onDone();
    } catch (e) {
      setProblem(restErrorText(e, "Saving"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="surface">
      <Text style={s.heading}>{story ? "Edit story" : "Add story"}</Text>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
      {PARTS.map(([k, label]) => (
        <TextField key={k} label={label} value={parts[k]} onChangeText={(v) => setParts((x) => ({ ...x, [k]: v }))} multiline maxLength={3000} />
      ))}
      <TextField label="Tags" hint="Separate with commas" value={tags} onChangeText={setTags} maxLength={300} autoCapitalize="none" placeholder="incident, leadership" />
      <View style={s.group}>
        <Text style={s.label}>Goal</Text>
        <View style={s.chips}>
          <Chip label="None" on={goalId === null} onPress={() => setGoalId(null)} />
          {goals.map((g) => (
            <Chip key={g.id} label={g.name} on={goalId === g.id} onPress={() => setGoalId(g.id)} />
          ))}
        </View>
      </View>
      {problem ? (
        <Text accessibilityRole="alert" style={s.body}>
          {problem}
        </Text>
      ) : null}
      <BigButton label="Save" variant="accent" busy={busy} onPress={() => void save()} />
      {story ? (
        <BigButton
          label="Delete story"
          variant="quiet"
          size="compact"
          onPress={async () => {
            try {
              await storiesApi.remove(qc, story.id);
              onDone();
            } catch (e) {
              setProblem(restErrorText(e, "Deleting"));
            }
          }}
        />
      ) : null}
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </Card>
  );
}

// ---------- Japanese ----------

const KINDS: readonly { value: JapaneseKind; label: string }[] = [
  { value: "anki", label: "Anki" },
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "speaking", label: "Speaking" },
  { value: "writing", label: "Writing" },
];
const MINUTES = [10, 15, 25, 45] as const;
const WEEKS = 8;
const mondayOf = (d: ISODate): ISODate => addDays(d, -((weekdayOf(d) + 6) % 7));

function Japanese() {
  const s = useStyles(makeStyles);
  const qc = useQueryClient();
  const today = useToday();
  const thisMonday = mondayOf(today);
  const from = addDays(thisMonday, -7 * (WEEKS - 1));
  const list = japaneseApi.useList({ from });
  const [kind, setKind] = useState<JapaneseKind>("anki");
  const [minutes, setMinutes] = useState("15");
  const [date, setDate] = useState<ISODate>(today);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = list.data ?? [];
  const weekTotal = items.filter((e) => e.date >= thisMonday).reduce((sum, e) => sum + e.minutes, 0);
  const columns = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(from, 7 * i);
    const end = addDays(start, 6);
    return { start, min: items.filter((e) => e.date >= start && e.date <= end).reduce((sum, e) => sum + e.minutes, 0) };
  });

  async function log() {
    const n = Number.parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 1 || n > 600 || busy) return void setMsg("Use a number of minutes from 1 to 600.");
    setBusy(true);
    try {
      await japaneseApi.create(qc, { date, minutes: n, kind, note: note.trim() || null });
      tapDone();
      setNote("");
      setMsg(`Logged ${n} min of ${kind}.`);
    } catch (e) {
      setMsg(restErrorText(e, "Logging"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card tone="surface">
        <Text style={s.heading}>Log practice</Text>
        <View style={s.chips}>
          {KINDS.map((k) => (
            <Chip key={k.value} label={k.label} on={kind === k.value} onPress={() => setKind(k.value)} />
          ))}
        </View>
        <View style={s.chips}>
          {MINUTES.map((m) => (
            <Chip key={m} label={`${m} min`} on={minutes === String(m)} onPress={() => setMinutes(String(m))} />
          ))}
        </View>
        <TextField label="Other minutes" value={minutes} onChangeText={(v) => setMinutes(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={3} />
        <DateStepper label="Day" value={date} onChange={setDate} max={today} />
        <TextField label="Note" value={note} onChangeText={setNote} maxLength={500} />
        <BigButton label="Log" variant="accent" busy={busy} onPress={() => void log()} />
        {msg ? <Text style={s.small}>{msg}</Text> : null}
      </Card>

      <Card tone="surface">
        <Text style={s.heading}>Minutes per week</Text>
        <Text style={s.small}>This week: {weekTotal} min</Text>
        {columns.map((c) => (
          <View key={c.start} style={s.between}>
            <Text style={s.body}>Week of {shortDate(c.start)}</Text>
            <Text style={s.body}>{c.min} min</Text>
          </View>
        ))}
      </Card>

      <ErrorLine list={list} what="The Japanese log" />
      <Card tone="surface">
        <Text style={s.heading}>Recent</Text>
        {items.length === 0 ? <Text style={s.small}>{list.isLoading ? "Opening…" : "Nothing logged in the last 8 weeks."}</Text> : null}
        {[...items]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 20)
          .map((e) => (
            <Entry key={e.id} e={e} onRemove={() => void japaneseApi.remove(qc, e.id).catch((err: unknown) => setMsg(restErrorText(err, "Removing")))} />
          ))}
      </Card>
    </>
  );
}

function Entry({ e, onRemove }: { e: JapaneseLogEntry; onRemove: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.between}>
      <View style={s.flex}>
        <Text style={s.body}>
          {e.kind} · {e.minutes} min
        </Text>
        <Text style={s.small}>
          {longDate(e.date)}
          {e.note ? ` · ${e.note}` : ""}
        </Text>
      </View>
      <BigButton label="Remove" variant="quiet" size="compact" onPress={onRemove} accessibilityLabel={`Remove ${e.minutes} minutes of ${e.kind} on ${longDate(e.date)}`} />
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink2 },
    heading: { ...f(600, 17, 24), color: c.ink },
    title: { ...f(600, 17, 24), color: c.ink },
    section: { ...f(600, 13, 18), color: c.ink2, marginTop: space(0.5) },
    flex: { flex: 1 },
    group: { gap: space(0.75) },
    between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(1.5) },
    rowBtns: { flexDirection: "row", gap: space(1) },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2 },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
    pill: { backgroundColor: c.surface2, borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: 6 },
    pillText: { ...f(600, 13, 18), color: c.ink },
  });
