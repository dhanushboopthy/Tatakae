import "@blocknote/mantine/style.css";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";

// BlockNote editor (v3 notes). Loaded lazily from routes/Notes so the editor bundle only downloads
// when a note opens. `dark` follows the app theme (not the OS); index.css maps BlockNote's colour
// variables onto the Soft Bento tokens. The caller keys it by note id: the editor is created once per
// note and owns the document from then on.

export default function NoteEditor(props: {
  initial: unknown[] | null;
  dark: boolean;
  onChange: (blocks: unknown[]) => void;
  uploadFile: (file: File) => Promise<string>;
  label: string;
}) {
  const editor = useCreateBlockNote({
    // BlockNote rejects an empty array; undefined starts with one empty paragraph.
    initialContent: props.initial && props.initial.length > 0 ? (props.initial as PartialBlock[]) : undefined,
    uploadFile: props.uploadFile,
  });

  return (
    <BlockNoteView
      editor={editor}
      theme={props.dark ? "dark" : "light"}
      aria-label={props.label}
      className="-mx-4 min-h-[320px] md:-mx-6"
      onChange={() => props.onChange(editor.document as unknown[])}
    />
  );
}
