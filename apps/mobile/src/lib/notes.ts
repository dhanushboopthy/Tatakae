import { useQuery } from "@tanstack/react-query";
import type { Note, NoteSearchHit, NoteSummary } from "@tatakae/core";
import { apiGet, apiPost, ApiError } from "../api/client";
import { noteFromText } from "./noteText";

// Notes on the phone (v3.3): save a capture as a note, search and read. Notes are REST only (R2-7),
// not synced, so all of this needs a connection; editing stays on the laptop.

/** Recent notes shown before a search is typed. */
const RECENT = 20;

/** True when the request never reached the server. */
export const isOffline = (e: unknown): boolean => e instanceof ApiError && e.status === 0;

/** POST /notes with the first line as the title. Throws ApiError (status 0 = offline). */
export async function saveAsNote(text: string): Promise<Note | null> {
  const draft = noteFromText(text);
  if (!draft) return null;
  const res = await apiPost<{ item: Note }>("/notes", draft);
  return res.item;
}

export function useRecentNotes() {
  return useQuery({
    queryKey: ["notes", "recent"],
    queryFn: async () => (await apiGet<{ items: NoteSummary[] }>("/notes")).items.slice(0, RECENT),
    staleTime: 60_000,
  });
}

export function useNoteSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["notes", "search", query],
    queryFn: async () => (await apiGet<{ items: NoteSearchHit[] }>(`/notes/search?q=${encodeURIComponent(query)}`)).items,
    enabled: query !== "",
    staleTime: 60_000,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: ["notes", "item", id],
    queryFn: async () => (await apiGet<{ item: Note }>(`/notes/${encodeURIComponent(id)}`)).item,
    enabled: id !== "",
    staleTime: 60_000,
  });
}
