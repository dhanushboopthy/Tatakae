import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { blocksToText } from "@tatakae/core";
import { isOffline, useNote } from "../../src/lib/notes";
import { paragraphsOf } from "../../src/lib/noteText";
import { ago } from "../../src/lib/format";
import { Card, Screen, SheetHeader } from "../../src/components/Screen";
import { f, radius, space } from "../../src/theme";
import { useStyles, type Theme } from "../../src/lib/theme";

/** One note, read-only (v3.3): title, tags and the text. Editing stays on the laptop. */
export default function NoteView() {
  const s = useStyles(makeStyles);
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: note, isPending, isError, error } = useNote(id);

  const paragraphs = note ? paragraphsOf(blocksToText(note.bodyJson)) : [];

  return (
    <Screen sheet>
      <SheetHeader title={note?.title ?? "Note"} subtitle={note ? `Edited ${ago(note.updatedAt)}` : undefined} onClose={() => router.back()} closeLabel="Back to notes" />
      {isError ? (
        <Card tone="surface">
          <Text style={s.muted}>{isOffline(error) ? "This note needs a connection to open." : "This note couldn't load. It may have been deleted on the laptop."}</Text>
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
          {note.sourceUrl ? (
            <Text style={s.muted} selectable>
              Source: {note.sourceUrl}
            </Text>
          ) : null}
          <Text style={s.muted}>To change this note, open it on the laptop.</Text>
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    body: { ...f(400, 16, 24), color: c.ink },
    muted: { ...f(500, 14, 20), color: c.ink2 },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: space(1) },
    tag: { backgroundColor: c.lavenderSoft, borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
    tagText: { ...f(600, 13, 18), color: c.onFill },
  });
