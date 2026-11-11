import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import type {
  Application,
  ApplicationInput,
  ApplicationPatch,
  InterviewStory,
  InterviewStoryInput,
  InterviewStoryPatch,
  JapaneseLogEntry,
  JapaneseLogInput,
  JapaneseLogPatch,
  Note,
  NoteInput,
  NotePatch,
} from "@tatakae/core";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../api/client";

// REST-only data on the phone (website: Library and Notes): applications, interview stories, the Japanese log and
// note editing. These tables are not synced, so they need a connection; screens say so calmly instead of failing.
// Query keys start with "rest" so they can be cleared together.

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
  return e instanceof ApiError && e.status === 0 ? `${what} needs a connection. Try again when you're online.` : `${what} didn't work. Try again.`;
}

function collection<T extends { id: string }, I, P>(path: string) {
  const key = ["rest", path] as const;
  return {
    key,
    useList(params: Record<string, string | undefined> = {}) {
      return useQuery({
        queryKey: [...key, params],
        queryFn: async () => itemsOf<T>(await apiGet(`/${path}${qs(params)}`)),
        placeholderData: keepPreviousData,
      });
    },
    async create(qc: QueryClient, input: I): Promise<T> {
      const item = itemOf<T>(await apiPost(`/${path}`, input));
      await qc.invalidateQueries({ queryKey: key });
      return item;
    },
    async update(qc: QueryClient, id: string, patch: P): Promise<T> {
      const item = itemOf<T>(await apiPatch(`/${path}/${encodeURIComponent(id)}`, patch));
      await qc.invalidateQueries({ queryKey: key });
      return item;
    },
    async remove(qc: QueryClient, id: string): Promise<void> {
      await apiDelete(`/${path}/${encodeURIComponent(id)}`);
      await qc.invalidateQueries({ queryKey: key });
    },
  };
}

type Loose<T> = { [K in keyof T]?: T[K] };

export const applicationsApi = collection<Application, Loose<ApplicationInput> & Pick<ApplicationInput, "company" | "role">, ApplicationPatch>("applications");
export const storiesApi = collection<InterviewStory, Loose<InterviewStoryInput> & Pick<InterviewStoryInput, "title">, InterviewStoryPatch>("stories");
export const japaneseApi = collection<JapaneseLogEntry, Loose<JapaneseLogInput> & Pick<JapaneseLogInput, "date" | "minutes" | "kind">, JapaneseLogPatch>("japanese");

// ---------- notes (editing; reading and search are in lib/notes.ts) ----------

export async function createNote(qc: QueryClient, input: Partial<NoteInput> & { title: string }): Promise<Note> {
  const note = itemOf<Note>(await apiPost("/notes", input));
  void qc.invalidateQueries({ queryKey: ["notes"] });
  return note;
}

export async function patchNote(qc: QueryClient, id: string, patch: NotePatch): Promise<Note> {
  const note = itemOf<Note>(await apiPatch(`/notes/${encodeURIComponent(id)}`, patch));
  qc.setQueryData(["notes", "item", id], note);
  void qc.invalidateQueries({ queryKey: ["notes", "recent"] });
  void qc.invalidateQueries({ queryKey: ["notes", "search"] });
  return note;
}

export async function deleteNote(qc: QueryClient, id: string): Promise<void> {
  await apiDelete(`/notes/${encodeURIComponent(id)}`);
  qc.removeQueries({ queryKey: ["notes", "item", id] });
  await qc.invalidateQueries({ queryKey: ["notes"] });
}
