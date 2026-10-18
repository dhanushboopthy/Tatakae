import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { isOffline, useNoteSearch, useRecentNotes } from "../../src/lib/notes";
import { ago } from "../../src/lib/format";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { f, minTarget, radius, space } from "../../src/theme";
import { pressedStyle, useStyles, type Theme } from "../../src/lib/theme";

const DEBOUNCE_MS = 300;

interface Row {
  id: string;
  title: string;
  line: string;
  updatedAt: string;
}

/**
 * Notes on the phone (v3.3): search and read only. Editing stays on the laptop. Notes aren't synced
 * (R2-7), so this needs a connection and says so calmly when there isn't one.
 */
export default function Notes() {
  const s = useStyles(makeStyles);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const recent = useRecentNotes();
  const search = useNoteSearch(q);
  const searching = q !== "";
  const active = searching ? search : recent;
  const rows: Row[] = searching
    ? (search.data ?? []).map((h) => ({ id: h.id, title: h.title, line: h.snippet, updatedAt: h.updatedAt }))
    : (recent.data ?? []).map((n) => ({ id: n.id, title: n.title, line: n.excerpt, updatedAt: n.updatedAt }));

  let status: string | null = null;
  if (active.isError) {
    status = isOffline(active.error) ? "Notes need a connection. They'll be here when you're back online." : "Notes couldn't load just now. Try again in a moment.";
  } else if (active.isPending) {
    status = searching ? "Searching…" : "Loading…";
  } else if (rows.length === 0) {
    status = searching ? "Nothing matches that. Try a different word." : "No notes yet. Write them on the laptop, or save a capture as a note.";
  }

  return (
    <Screen sheet>
      <SheetHeader title="Notes" subtitle="Search and read. Editing stays on the laptop." onClose={() => router.back()} />
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="Search notes"
        accessibilityLabel="Search notes"
        tone="surface"
        returnKeyType="search"
        autoCorrect={false}
        maxLength={200}
        onSubmitEditing={() => setQ(text.trim())}
      />
      {!searching && rows.length > 0 ? <Text style={s.section}>Recent</Text> : null}
      {status ? (
        <Card tone="surface">
          <Text style={s.body} accessibilityLiveRegion="polite">
            {status}
          </Text>
        </Card>
      ) : null}
      {rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push({ pathname: "/notes/[id]", params: { id: r.id } })}
          accessibilityRole="button"
          accessibilityLabel={r.title}
          accessibilityHint="Opens the note"
          style={({ pressed }) => [s.row, pressed && pressedStyle]}
        >
          <Text style={s.title} numberOfLines={2}>
            {r.title}
          </Text>
          {r.line ? (
            <Text style={s.line} numberOfLines={3}>
              {r.line}
            </Text>
          ) : null}
          <Text style={s.meta}>Edited {ago(r.updatedAt)}</Text>
        </Pressable>
      ))}
      <View style={s.spacer} />
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    section: { ...f(600, 13, 18), color: c.ink2, marginTop: space(0.5) },
    body: { ...f(500, 15, 22), color: c.ink2 },
    row: { backgroundColor: c.surface, borderRadius: radius.card, padding: space(2.5), gap: space(0.75), minHeight: minTarget },
    title: { ...f(600, 17, 23), color: c.ink },
    line: { ...f(400, 15, 21), color: c.ink2 },
    meta: { ...f(500, 13, 18), color: c.ink2 },
    spacer: { height: space(2) },
  });
