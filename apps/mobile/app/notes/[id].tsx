import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { blocksToText, isHttpUrl, isPlainBody, normalizeTags, plainBodyText, textToBlocks, type Note } from "@tatakae/core";
import { isOffline, useNote } from "../../src/lib/notes";
import { createNote, deleteNote, patchNote, restErrorText } from "../../src/lib/rest";
import { paragraphsOf } from "../../src/lib/noteText";
import { ago } from "../../src/lib/format";
import { BigButton } from "../../src/components/BigButton";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { tapDone, tapLight } from "../../src/haptics";
import { f, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, type Theme } from "../../src/lib/theme";

/**
 * One note: read it, or edit it (title, text, tags, the explain/implement flags, source link). Notes are REST only
 * (not synced), so saving needs a connection. A note with formatting the phone editor can't keep (headings, lists,
 * bold, links) opens for everything except its text, so nothing is flattened. `/notes/new` starts a blank note.
 */
export default function NoteScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  if (id === "new") return <NoteEditor note={null} onDone={() => router.back()} />;
  return <NoteView id={id} />;
}

function NoteView({ id }: { id: string }) {
  const s = useStyles(makeStyles);
  const { data: note, isPending, isError, error } = useNote(id);
  const [editing, setEditing] = useState(false);
  const paragraphs = note ? paragraphsOf(blocksToText(note.bodyJson)) : [];

  if (editing && note) return <NoteEditor note={note} onDone={() => setEditing(false)} />;

  return (
    <Screen sheet>
      <SheetHeader title={note?.title ?? "Note"} subtitle={note ? `Edited ${ago(note.updatedAt)}` : undefined} onClose={() => router.back()} closeLabel="Back to notes" />
      {isError ? (
        <Card tone="surface">
          <Text style={s.muted}>{isOffline(error) ? "This note needs a connection to open." : "This note couldn't load. It may have been deleted."}</Text>
        </Card>
      ) : isPending ? (
        <Card tone="surface">
          <Text style={s.muted}>Loading…</Text>
        </Card>
      ) : note ? (
        <>
          {note.tags.length > 0 ? (
            <View style={s.tags} accessibilityLabel={`Tags: ${note.tags.join(", ")}`}>
              {note.tags.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Card tone="surface">
            {paragraphs.length === 0 ? (
              <Text style={s.muted}>No text in this note yet.</Text>
            ) : (
              paragraphs.map((p, i) => (
                <Text key={i} style={s.body} selectable>
                  {p}
                </Text>
              ))
            )}
          </Card>
          {note.canExplain != null || note.canImplement != null || note.misunderstood ? (
            <Card tone="surface">
              {note.canExplain != null ? <Text style={s.body}>Can I explain it? {note.canExplain ? "Yes" : "Not yet"}</Text> : null}
              {note.canImplement != null ? <Text style={s.body}>Can I implement it? {note.canImplement ? "Yes" : "Not yet"}</Text> : null}
              {note.misunderstood ? <Text style={s.body}>Still unclear: {note.misunderstood}</Text> : null}
            </Card>
          ) : null}
          {note.sourceUrl ? (
            <Text style={s.muted} selectable>
              Source: {note.sourceUrl}
            </Text>
          ) : null}
          <BigButton label="Edit note" variant="accent" onPress={() => setEditing(true)} />
        </>
      ) : null}
    </Screen>
  );
}

type Flag = boolean | null;

function FlagPick({ label, value, onChange }: { label: string; value: Flag; onChange: (v: Flag) => void }) {
  const s = useStyles(makeStyles);
  const opts: readonly { v: Flag; t: string }[] = [
    { v: true, t: "Yes" },
    { v: false, t: "Not yet" },
    { v: null, t: "Unsure" },
  ];
  return (
    <View style={s.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {opts.map((o) => (
          <Pressable
            key={o.t}
            onPress={() => {
              tapLight();
              onChange(o.v);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === o.v }}
            style={({ pressed }) => [s.chip, value === o.v && s.chipOn, pressed && pressedStyle]}
          >
            <Text style={s.chipText}>
              {value === o.v ? "✓ " : ""}
              {o.t}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NoteEditor({ note, onDone }: { note: Note | null; onDone: () => void }) {
  const s = useStyles(makeStyles);
  const qc = useQueryClient();
  const plain = isPlainBody(note?.bodyJson ?? null);
  const original = useRef(plain ? plainBodyText(note?.bodyJson ?? null) : "");
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(original.current);
  const [tags, setTags] = useState(note?.tags.join(", ") ?? "");
  const [source, setSource] = useState(note?.sourceUrl ?? "");
  const [canExplain, setCanExplain] = useState<Flag>(note?.canExplain ?? null);
  const [canImplement, setCanImplement] = useState<Flag>(note?.canImplement ?? null);
  const [misunderstood, setMisunderstood] = useState(note?.misunderstood ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    if (busy) return;
    if (!title.trim()) return void setProblem("A note needs a title.");
    if (source.trim() && !isHttpUrl(source.trim())) return void setProblem("The source should be a web link (https://…).");
    setBusy(true);
    setProblem(null);
    try {
      const fields = {
        title: title.trim().slice(0, 300),
        tags: normalizeTags(tags.split(",")),
        sourceUrl: source.trim() || null,
        canExplain,
        canImplement,
        misunderstood: misunderstood.trim() || null,
      };
      const bodyChanged = plain && body !== original.current;
      const bodyJson = body.trim() ? textToBlocks(body.replace(/\s+$/, "")) : null;
      if (note) await patchNote(qc, note.id, { ...fields, ...(bodyChanged ? { bodyJson } : {}) });
      else await createNote(qc, { ...fields, bodyJson });
      tapDone();
      onDone();
    } catch (e) {
      setProblem(restErrorText(e, "Saving"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen sheet footer={<BigButton label="Save note" variant="accent" size="large" busy={busy} disabled={!title.trim()} onPress={() => void save()} />}>
      <SheetHeader title={note ? "Edit note" : "New note"} onClose={onDone} closeLabel="Cancel" />
      <Card tone="surface">
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={300} />
        {plain ? (
          <TextField label="Text" value={body} onChangeText={setBody} multiline maxLength={50000} style={s.bodyInput} />
        ) : (
          <Text style={s.muted}>This note has formatting (headings, lists, bold or links) that the phone editor would flatten, so its text is left alone. Edit the text on the laptop; everything else can change here.</Text>
        )}
        <TextField label="Tags" hint="Separate with commas" value={tags} onChangeText={setTags} maxLength={400} autoCapitalize="none" />
        <TextField label="Source link" value={source} onChangeText={setSource} maxLength={500} autoCapitalize="none" keyboardType="url" placeholder="https://" />
      </Card>
      <Card tone="surface">
        <Text style={s.heading}>Do I really know it?</Text>
        <FlagPick label="Can I explain it?" value={canExplain} onChange={setCanExplain} />
        <FlagPick label="Can I implement it?" value={canImplement} onChange={setCanImplement} />
        <TextField label="What is still unclear?" value={misunderstood} onChangeText={setMisunderstood} multiline maxLength={2000} />
      </Card>
      {problem ? (
        <Text accessibilityRole="alert" style={s.body}>
          {problem}
        </Text>
      ) : null}
      {note ? (
        confirmDelete ? (
          <Card tone="surface2">
            <Text style={s.body}>Delete this note? It can't be brought back.</Text>
            <BigButton
              label="Yes, delete it"
              variant="danger"
              onPress={async () => {
                try {
                  await deleteNote(qc, note.id);
                  router.back();
                } catch (e) {
                  setProblem(restErrorText(e, "Deleting"));
                  setConfirmDelete(false);
                }
              }}
            />
            <BigButton label="Keep it" variant="primary" onPress={() => setConfirmDelete(false)} />
          </Card>
        ) : (
          <BigButton label="Delete note" variant="quiet" size="compact" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(400, 16, 24), color: c.ink },
    muted: { ...f(500, 14, 20), color: c.ink2 },
    label: { ...f(600, 13, 18), color: c.ink },
    heading: { ...f(600, 17, 24), color: c.ink },
    group: { gap: space(0.75) },
    bodyInput: { minHeight: 220 },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    tag: { backgroundColor: c.lavenderSoft, borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
    tagText: { ...f(600, 13, 18), color: c.onFill },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space(2), borderRadius: radius.pill, backgroundColor: c.surface2 },
    chipOn: { backgroundColor: c.lime },
    chipText: { ...f(600, 14, 20), color: c.ink },
  });
