import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  Application,
  ApplicationInput,
  ApplicationPatch,
  FileMeta,
  InterviewStory,
  InterviewStoryInput,
  InterviewStoryPatch,
  JapaneseLogEntry,
  JapaneseLogInput,
  JapaneseLogPatch,
  Note,
  NoteInput,
  NotePatch,
  NoteSearchHit,
  NoteSummary,
} from "@tatakae/core";
import { api, apiUpload, isNetworkError } from "./api";

// REST-only data (v3): notes, files, applications, interview stories, Japanese log. These tables are
// not synced, so they need a connection; screens say so calmly instead of failing. Query keys all
// start with "rest" (Settings → Data uses the same prefix).

const itemsOf = <T,>(body: unknown): T[] => {
  const items = typeof body === "object" && body !== null ? (body as { items?: unknown }).items : undefined;
  return Array.isArray(items) ? (items as T[]) : [];
};
const itemOf = <T,>(body: unknown): T => (body as { item: T }).item;

const qs = (params: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** One calm line for a failed REST call. */
export function restErrorText(e: unknown, what = "This"): string {
  return isNetworkError(e) ? `${what} needs a connection. Try again when you're online.` : `${what} didn't load. Try again.`;
}

// ---------- notes ----------

export const NOTES_KEY = ["rest", "notes"] as const;

export function useNotes(filter: { tag?: string; goalId?: string } = {}) {
  return useQuery({
    queryKey: [...NOTES_KEY, "list", filter],
    queryFn: async () => itemsOf<NoteSummary>(await api(`/notes${qs(filter)}`)),
    placeholderData: keepPreviousData,
  });
}

export function useNoteSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: [...NOTES_KEY, "search", term],
    queryFn: async () => itemsOf<NoteSearchHit>(await api(`/notes/search${qs({ q: term })}`)),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: [...NOTES_KEY, "one", id],
    queryFn: async () => itemOf<Note>(await api(`/notes/${encodeURIComponent(id ?? "")}`)),
    enabled: Boolean(id),
    staleTime: Infinity, // the open editor owns the note; refetching would fight local edits
    retry: false,
  });
}

export async function createNote(qc: QueryClient, input: Partial<NoteInput> & { title: string }): Promise<Note> {
  const note = itemOf<Note>(await api("/notes", { method: "POST", body: input }));
  qc.setQueryData([...NOTES_KEY, "one", note.id], note);
  void qc.invalidateQueries({ queryKey: [...NOTES_KEY, "list"] });
  return note;
}

export async function patchNote(qc: QueryClient, id: string, patch: NotePatch): Promise<Note> {
  const note = itemOf<Note>(await api(`/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }));
  void qc.invalidateQueries({ queryKey: [...NOTES_KEY, "list"] });
  void qc.invalidateQueries({ queryKey: [...NOTES_KEY, "search"] });
  return note;
}

export async function deleteNote(qc: QueryClient, id: string): Promise<void> {
  await api(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  qc.removeQueries({ queryKey: [...NOTES_KEY, "one", id] });
  await qc.invalidateQueries({ queryKey: NOTES_KEY });
}

export type SaveState = "saved" | "saving" | "unsaved" | "offline";

/**
 * Debounced autosave for one note: `queue(patch)` merges into a pending patch that is sent after
 * `delayMs` of quiet. A failed save keeps the patch and retries on the next edit or `flush()`.
 * Pending edits are flushed on unmount (switching notes or leaving the page).
 */
export function useNoteAutosave(id: string, delayMs = 800) {
  const qc = useQueryClient();
  const pending = useRef<NotePatch>({});
  const timer = useRef<number | null>(null);
  const [state, setState] = useState<SaveState>("saved");

  const flush = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setState("saving");
    try {
      const note = await patchNote(qc, id, patch);
      qc.setQueryData([...NOTES_KEY, "one", id], note);
      setState(Object.keys(pending.current).length > 0 ? "unsaved" : "saved");
    } catch (e) {
      pending.current = { ...patch, ...pending.current };
      setState(isNetworkError(e) ? "offline" : "unsaved");
    }
  }, [qc, id]);

  const queue = useCallback(
    (patch: NotePatch) => {
      pending.current = { ...pending.current, ...patch };
      setState("unsaved");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => () => void flush(), [flush]);

  // Saves that failed offline go out as soon as the connection is back.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  return { queue, flush, state };
}

// ---------- files ----------

export function useNoteFiles(noteId: string) {
  return useQuery({
    queryKey: ["rest", "files", noteId],
    queryFn: async () => itemsOf<FileMeta>(await api(`/files${qs({ noteId })}`)),
  });
}

export const fileUrl = (id: string) => `/api/files/${encodeURIComponent(id)}`;

export async function uploadFile(qc: QueryClient, file: File, noteId: string | null): Promise<FileMeta> {
  const form = new FormData();
  form.set("file", file);
  if (noteId) form.set("noteId", noteId);
  const meta = itemOf<FileMeta>(await apiUpload("/files", form));
  void qc.invalidateQueries({ queryKey: ["rest", "files"] });
  return meta;
}

export async function deleteFile(qc: QueryClient, id: string): Promise<void> {
  await api(`/files/${encodeURIComponent(id)}`, { method: "DELETE" });
  await qc.invalidateQueries({ queryKey: ["rest", "files"] });
}

export const formatBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

// ---------- simple collections (applications, stories, Japanese log) ----------

function collection<T extends { id: string }, I, P>(path: string) {
  const key = ["rest", path] as const;
  return {
    key,
    useList(params: Record<string, string | undefined> = {}) {
      return useQuery({
        queryKey: [...key, params],
        queryFn: async () => itemsOf<T>(await api(`/${path}${qs(params)}`)),
        placeholderData: keepPreviousData,
      });
    },
    async create(qc: QueryClient, input: I): Promise<T> {
      const item = itemOf<T>(await api(`/${path}`, { method: "POST", body: input }));
      await qc.invalidateQueries({ queryKey: key });
      return item;
    },
    async update(qc: QueryClient, id: string, patch: P): Promise<T> {
      const item = itemOf<T>(await api(`/${path}/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }));
      await qc.invalidateQueries({ queryKey: key });
      return item;
    },
    async remove(qc: QueryClient, id: string): Promise<void> {
      await api(`/${path}/${encodeURIComponent(id)}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: key });
    },
  };
}

/** Inputs as the client sends them: zod fills the defaults server-side. */
type Loose<T> = { [K in keyof T]?: T[K] };

export const applicationsApi = collection<Application, Loose<ApplicationInput> & Pick<ApplicationInput, "company" | "role">, ApplicationPatch>(
  "applications",
);
export const storiesApi = collection<InterviewStory, Loose<InterviewStoryInput> & Pick<InterviewStoryInput, "title">, InterviewStoryPatch>(
  "stories",
);
export const japaneseApi = collection<JapaneseLogEntry, Loose<JapaneseLogInput> & Pick<JapaneseLogInput, "date" | "minutes" | "kind">, JapaneseLogPatch>(
  "japanese",
);
