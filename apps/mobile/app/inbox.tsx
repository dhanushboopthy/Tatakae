import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AFTER_P1, addDays, firstFreeSlot, type ISODate, type InboxItem, type Slot } from "@tatakae/core";
import { capture, useDay, useInbox, useToday } from "../src/lib/hooks";
import { discardInbox, editInbox, inboxToMission, markProcessed, restoreInbox } from "../src/lib/planning";
import { isOffline, saveAsNote } from "../src/lib/notes";
import { ago } from "../src/lib/format";
import { BigButton } from "../src/components/BigButton";
import { SegmentedPills } from "../src/components/SegmentedPills";
import { Card, Screen, SheetHeader } from "../src/components/Screen";
import { TextField } from "../src/components/TextField";
import { tapDone } from "../src/haptics";
import { f, space } from "../src/theme";
import { useStyles, type Theme } from "../src/lib/theme";

// Inbox (website: Inbox): everything captured, sorted into a mission (backlog, today or tomorrow), a note, an edit
// or the bin. Inbox zero is a calm empty state. Writes go through the outbox; notes need a connection.

export default function Inbox() {
  const s = useStyles(makeStyles);
  const { data: items = [], isLoading } = useInbox();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [undo, setUndo] = useState<InboxItem | null>(null);

  async function add() {
    if (!text.trim()) return;
    await capture(text);
    tapDone();
    setText("");
  }

  return (
    <Screen sheet>
      <SheetHeader title={items.length ? `${items.length} to sort` : "Inbox"} onClose={() => router.back()} />
      <Card tone="surface">
        <TextField label="Capture" value={text} onChangeText={setText} maxLength={1000} placeholder="Anything on your mind" onSubmitEditing={() => void add()} returnKeyType="done" />
        <BigButton label="Add to inbox" variant="secondary" disabled={!text.trim()} onPress={() => void add()} />
      </Card>

      {undo ? (
        <Card tone="surface2">
          <Text style={s.body}>Discarded.</Text>
          <BigButton
            label="Undo"
            variant="secondary"
            size="compact"
            onPress={async () => {
              await restoreInbox(undo);
              setUndo(null);
            }}
          />
        </Card>
      ) : null}
      {msg ? <Text style={s.small}>{msg}</Text> : null}

      {isLoading ? null : items.length === 0 ? (
        <Card tone="surface">
          <Text style={s.heading}>Inbox zero.</Text>
          <Text style={s.small}>Capture anything with one tap from the + on Today.</Text>
        </Card>
      ) : (
        items.map((item) => <Row key={item.id} item={item} onMsg={setMsg} onDiscard={(i) => setUndo(i)} />)
      )}
    </Screen>
  );
}

type Mode = "idle" | "edit" | "mission";

function Row({ item, onMsg, onDiscard }: { item: InboxItem; onMsg: (m: string | null) => void; onDiscard: (i: InboxItem) => void }) {
  const s = useStyles(makeStyles);
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);

  async function toNote() {
    if (busy) return;
    setBusy(true);
    try {
      const note = await saveAsNote(item.text);
      if (note) {
        await markProcessed(item);
        tapDone();
        onMsg("Saved as a note.");
      }
    } catch (e) {
      onMsg(isOffline(e) ? "Notes need a connection. Try again when you're online." : "Couldn't make a note. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="surface">
      {mode === "edit" ? (
        <EditItem item={item} onDone={() => setMode("idle")} />
      ) : (
        <>
          <Text style={s.body}>{item.text}</Text>
          <Text style={s.small}>{ago(item.createdAt)}</Text>
          {mode === "mission" ? (
            <ToMission item={item} onDone={(m) => (onMsg(m), setMode("idle"))} onCancel={() => setMode("idle")} />
          ) : (
            <View style={s.row}>
              <BigButton label="Mission" variant="accent" size="compact" onPress={() => setMode("mission")} style={s.flex} />
              <BigButton label="Note" variant="secondary" size="compact" busy={busy} onPress={() => void toNote()} style={s.flex} />
              <BigButton label="Edit" variant="secondary" size="compact" onPress={() => setMode("edit")} style={s.flex} />
              <BigButton
                label="Discard"
                variant="quiet"
                size="compact"
                onPress={async () => {
                  await discardInbox(item);
                  onDiscard(item);
                }}
                style={s.flex}
              />
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function EditItem({ item, onDone }: { item: InboxItem; onDone: () => void }) {
  const [text, setText] = useState(item.text);
  return (
    <>
      <TextField label="Edit item" value={text} onChangeText={setText} maxLength={1000} multiline autoFocus />
      <BigButton
        label="Save"
        variant="accent"
        onPress={async () => {
          await editInbox(item, text);
          onDone();
        }}
      />
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onDone} />
    </>
  );
}

type Target = "backlog" | "today" | "tomorrow";

function ToMission({ item, onDone, onCancel }: { item: InboxItem; onDone: (message: string) => void; onCancel: () => void }) {
  const s = useStyles(makeStyles);
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const { data: todayView } = useDay(today);
  const { data: tomorrowView } = useDay(tomorrow);
  const [title, setTitle] = useState(item.text.slice(0, 200));
  const [target, setTarget] = useState<Target>("backlog");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const view = target === "today" ? todayView : target === "tomorrow" ? tomorrowView : null;
  const slot: Slot | null = view ? firstFreeSlot(view.missions, AFTER_P1) : "backlog";
  const date: ISODate | null = target === "today" ? today : target === "tomorrow" ? tomorrow : null;
  const locked = view?.forged === true;
  const reasonOk = !locked || reason.trim().length >= 3;

  async function save() {
    if (!slot || !title.trim() || !reasonOk || busy) return;
    setBusy(true);
    try {
      await inboxToMission(item, { title, dayDate: date, slot }, locked ? { lockReason: reason.trim() } : undefined);
      tapDone();
      onDone(date ? `Added as ${slot === "side" ? "side quest" : slot} for ${target}.` : "Moved to the backlog.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
      <SegmentedPills
        accessibilityLabel="Where"
        value={target}
        onChange={setTarget}
        options={[
          { value: "backlog", label: "Backlog" },
          { value: "today", label: "Today" },
          { value: "tomorrow", label: "Tomorrow" },
        ]}
        stretch
      />
      <Text style={s.small}>
        {target === "backlog"
          ? "Pick it up in a ritual or the week planner."
          : slot
            ? `Goes in as ${slot === "side" ? "the side quest" : slot}.${locked ? " That plan is locked, so note why." : ""}`
            : "That day already has nine missions and a side quest. Use the backlog."}
      </Text>
      {locked ? <TextField label="Why add it to a locked plan?" value={reason} onChangeText={setReason} maxLength={250} /> : null}
      <BigButton label="Make mission" variant="accent" busy={busy} disabled={!title.trim() || !slot || !reasonOk} onPress={() => void save()} />
      <BigButton label="Cancel" variant="quiet" size="compact" onPress={onCancel} />
    </>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(500, 16, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    heading: { ...f(600, 17, 24), color: c.ink },
    row: { flexDirection: "row", flexWrap: "wrap", gap: space(0.75) },
    flex: { flexGrow: 1, minWidth: 80 },
  });
