import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Note, NotePatch, NoteSummary } from "@tatakae/core";
import { EmptyState } from "../components/EmptyState";
import { ArrowLeftIcon, CheckIcon, CloseIcon, DownloadIcon, NoteIcon, PlusIcon, SearchIcon, TrashIcon, UploadIcon } from "../components/icons";
import { LibraryTabs } from "../components/LibraryTabs";
import { SceneCard } from "../components/SceneCard";
import { Modal } from "../components/Modal";
import { Kural } from "../components/Kural";
import { PageHeader } from "../components/PageHeader";
import { SegmentedPills } from "../components/SegmentedPills";
import { useToast } from "../components/Toast";
import { useAreas, useGoals } from "../lib/hooks";
import {
  createNote,
  deleteFile,
  deleteNote,
  fileUrl,
  formatBytes,
  restErrorText,
  uploadFile,
  useNote,
  useNoteAutosave,
  useNoteFiles,
  useNotes,
  useNoteSearch,
  type SaveState,
} from "../lib/rest";
import { useIsDark } from "../lib/theme";

// Second brain (v3, docs/05): note list with FTS search and tag/goal filters on the left, the open
// note on the right — title, tags, goal/area links, "can explain / can implement / misunderstood",
// the BlockNote body and attachments. Everything autosaves. Notes are REST-only (not synced), so
// they need a connection; the screen says so instead of failing.

const NoteEditor = lazy(() => import("../components/NoteEditor"));

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function Notes() {
  const params = useParams();
  const id = params["*"] || undefined;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [search] = useSearchParams();

  async function newNote() {
    try {
      const note = await createNote(qc, { title: "Untitled note" });
      navigate({ pathname: `/notes/${note.id}`, search: search.toString() });
    } catch (e) {
      toast(restErrorText(e, "A new note"));
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Library"
        title="Notes"
        actions={
          <button type="button" className="btn-secondary" onClick={() => void newNote()}>
            <PlusIcon size={18} /> New note
          </button>
        }
      />
      <LibraryTabs />
      <SceneCard scene="notes" className="max-w-read" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className={id ? "hidden lg:block" : ""}>
          <NoteList activeId={id} />
        </div>
        <div className={id ? "" : "hidden lg:block"}>
          {id ? (
            <NoteDetail key={id} id={id} />
          ) : (
            <div className="space-y-6">
              <EmptyState
                icon={<NoteIcon />}
                title="Pick a note, or start a new one."
                body="Write what you learnt in your own words, then mark whether you can explain it and build it."
                action={
                  <button type="button" className="btn-primary" onClick={() => void newNote()}>
                    <PlusIcon size={18} /> New note
                  </button>
                }
              />
              <Kural n={391} size="sm" className="max-w-read" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- list

function topTags(notes: readonly NoteSummary[], n = 12): string[] {
  const counts = new Map<string, number>();
  for (const note of notes) for (const t of note.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([t]) => t);
}

function NoteList({ activeId }: { activeId: string | undefined }) {
  const [search, setSearch] = useSearchParams();
  const tag = search.get("tag") ?? undefined;
  const goalId = search.get("goal") ?? undefined;
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const searching = deferred.trim().length >= 2;

  const all = useNotes();
  const filtered = useNotes({ tag, goalId });
  const hits = useNoteSearch(searching ? deferred : "");
  const { data: goals = [] } = useGoals();
  const tags = useMemo(() => topTags(all.data ?? []), [all.data]);

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next, { replace: true });
  };
  const linkTo = (noteId: string) => ({ pathname: `/notes/${noteId}`, search: search.toString() });

  return (
    <section aria-label="Notes" className="card space-y-4 p-4 md:p-5">
      <div className="relative">
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
        <input
          id="note-search"
          type="search"
          className="input pl-11"
          placeholder="Search notes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!searching && (
        <div className="space-y-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setParam("tag", tag === t ? undefined : t)}
                  className={`chip px-3 text-[13px] ${tag === t ? "bg-lime text-on-accent" : "bg-surface-2 font-medium hover:bg-line"}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
          {goals.length > 0 && (
            <div>
              <label htmlFor="note-goal" className="sr-only">
                Filter by goal
              </label>
              <select id="note-goal" className="input" value={goalId ?? ""} onChange={(e) => setParam("goal", e.target.value || undefined)}>
                <option value="">All goals</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {searching ? (
        hits.isError ? (
          <p className="text-sm text-ink-2">{restErrorText(hits.error, "Search")}</p>
        ) : (hits.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{hits.isFetching ? "Searching…" : "Nothing matches yet."}</p>
        ) : (
          <ul className="space-y-1" aria-label="Search results">
            {(hits.data ?? []).map((h) => (
              <li key={h.id}>
                <NavLink to={linkTo(h.id)} className={`block rounded-card-inner p-3 ${h.id === activeId ? "bg-lime-soft" : "hover:bg-surface-2"}`}>
                  <p className="font-semibold">{h.title}</p>
                  {h.snippet && <p className="line-clamp-2 text-sm text-ink-2">{h.snippet}</p>}
                </NavLink>
              </li>
            ))}
          </ul>
        )
      ) : filtered.isError ? (
        <p className="text-sm text-ink-2">{restErrorText(filtered.error, "Notes")}</p>
      ) : (filtered.data ?? []).length === 0 ? (
        <p className="text-sm text-ink-2">{filtered.isLoading ? "Opening…" : tag || goalId ? "No notes with this filter." : "No notes yet."}</p>
      ) : (
        <ul className="space-y-1">
          {(filtered.data ?? []).map((n) => (
            <li key={n.id}>
              <NavLink
                to={linkTo(n.id)}
                aria-current={n.id === activeId ? "page" : undefined}
                className={`block rounded-card-inner p-3 ${n.id === activeId ? "bg-lime-soft" : "hover:bg-surface-2"}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold">{n.title}</p>
                  <span className="tnum shrink-0 text-xs text-ink-2">{when(n.updatedAt)}</span>
                </div>
                {n.excerpt && <p className="line-clamp-2 text-sm text-ink-2">{n.excerpt}</p>}
                <UnderstandingMarks note={n} />
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Small marks in the list: shape + label, never colour alone. */
function UnderstandingMarks({ note }: { note: Pick<Note, "canExplain" | "canImplement" | "misunderstood" | "tags"> }) {
  const marks: string[] = [];
  if (note.canExplain) marks.push("Can explain");
  if (note.canImplement) marks.push("Can build");
  if (note.misunderstood) marks.push("Has a gap");
  if (marks.length === 0 && note.tags.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
      {marks.map((m) => (
        <span key={m} className="pill bg-surface-2 px-2 py-0.5 text-xs font-medium">
          {m === "Has a gap" ? null : <CheckIcon size={12} />}
          {m}
        </span>
      ))}
      {note.tags.slice(0, 3).map((t) => (
        <span key={t} className="pill px-1 py-0.5 text-xs font-medium text-ink-2">
          #{t}
        </span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------- detail

function NoteDetail({ id }: { id: string }) {
  const { data: note, isError, error, isLoading } = useNote(id);
  if (isLoading) return <p className="card text-ink-2">Opening…</p>;
  if (isError || !note) {
    return (
      <EmptyState
        title="This note didn't open."
        body={restErrorText(error, "This note")}
        action={
          <Link to="/notes" className="btn-secondary">
            Back to notes
          </Link>
        }
      />
    );
  }
  return <NoteBody note={note} />;
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Not saved yet",
  offline: "Offline. It saves when you're back.",
};

type Tri = "yes" | "no" | "unset";
const toTri = (v: boolean | null): Tri => (v === true ? "yes" : v === false ? "no" : "unset");
const fromTri = (v: Tri): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

function validUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function NoteBody({ note }: { note: Note }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const dark = useIsDark();
  const { data: goals = [] } = useGoals();
  const { data: areas = [] } = useAreas();
  const { queue, flush, state } = useNoteAutosave(note.id);

  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [goalId, setGoalId] = useState(note.goalId ?? "");
  const [areaId, setAreaId] = useState(note.areaId ?? "");
  const [sourceUrl, setSourceUrl] = useState(note.sourceUrl ?? "");
  const [canExplain, setCanExplain] = useState<Tri>(toTri(note.canExplain));
  const [canImplement, setCanImplement] = useState<Tri>(toTri(note.canImplement));
  const [misunderstood, setMisunderstood] = useState(note.misunderstood ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (patch: NotePatch) => queue(patch);

  async function onUpload(file: File): Promise<string> {
    const meta = await uploadFile(qc, file, note.id);
    return fileUrl(meta.id);
  }

  async function onDelete() {
    try {
      await flush();
      await deleteNote(qc, note.id);
      setConfirmDelete(false);
      navigate("/notes");
      toast("Note deleted.");
    } catch (e) {
      toast(restErrorText(e, "Deleting"));
    }
  }

  return (
    <article aria-labelledby="note-title-label" className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/notes" className="icon-btn-sm lg:hidden" aria-label="Back to notes">
            <ArrowLeftIcon />
          </Link>
          <p className="flex-1 text-sm text-ink-2" role="status" aria-live="polite">
            {SAVE_LABEL[state]}
          </p>
          <button type="button" className="icon-btn-sm" aria-label="Delete note" onClick={() => setConfirmDelete(true)}>
            <TrashIcon size={18} />
          </button>
        </div>
        <label id="note-title-label" htmlFor="note-title" className="sr-only">
          Title
        </label>
        <input
          id="note-title"
          className="w-full rounded-field bg-transparent text-title-sm font-semibold placeholder:text-ink-2"
          maxLength={300}
          value={title}
          placeholder="Title"
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) save({ title: e.target.value.trim() });
          }}
        />
        <TagInput
          tags={tags}
          onChange={(next) => {
            setTags(next);
            save({ tags: next });
          }}
        />
        <Suspense fallback={<p className="min-h-[320px] text-ink-2">Opening the editor…</p>}>
          <NoteEditor
            initial={note.bodyJson}
            dark={dark}
            label={`Body of ${note.title}`}
            uploadFile={onUpload}
            onChange={(blocks) => save({ bodyJson: blocks })}
          />
        </Suspense>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="understand-title" className="card space-y-4">
          <h2 id="understand-title" className="text-base font-semibold">
            Do you have it?
          </h2>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-2">Can explain it simply</p>
            <SegmentedPills<Tri>
              label="Can explain it simply"
              value={canExplain}
              onChange={(v) => {
                setCanExplain(v);
                save({ canExplain: fromTri(v) });
              }}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "Not yet" },
                { value: "unset", label: "Not checked" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-2">Can build it from scratch</p>
            <SegmentedPills<Tri>
              label="Can build it from scratch"
              value={canImplement}
              onChange={(v) => {
                setCanImplement(v);
                save({ canImplement: fromTri(v) });
              }}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "Not yet" },
                { value: "unset", label: "Not checked" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="note-gap" className="label">
              What I misunderstood
            </label>
            <textarea
              id="note-gap"
              className="input min-h-[88px] py-3"
              maxLength={2000}
              value={misunderstood}
              placeholder="The part that surprised you, in one or two lines."
              onChange={(e) => {
                setMisunderstood(e.target.value);
                save({ misunderstood: e.target.value.trim() || null });
              }}
            />
          </div>
        </section>

        <section aria-labelledby="links-title" className="card space-y-4">
          <h2 id="links-title" className="text-base font-semibold">
            Links
          </h2>
          <div>
            <label htmlFor="note-goal-link" className="label">
              Goal
            </label>
            <select
              id="note-goal-link"
              className="input"
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
                save({ goalId: e.target.value || null });
              }}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="note-area" className="label">
              Area
            </label>
            <select
              id="note-area"
              className="input"
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                save({ areaId: e.target.value || null });
              }}
            >
              <option value="">No area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="note-source" className="label">
              Source link
            </label>
            <input
              id="note-source"
              type="url"
              className="input"
              placeholder="https://"
              value={sourceUrl}
              onChange={(e) => {
                const v = e.target.value.trim();
                setSourceUrl(e.target.value);
                if (!v) save({ sourceUrl: null });
                else if (validUrl(v)) save({ sourceUrl: v });
              }}
            />
            {sourceUrl.trim() && !validUrl(sourceUrl.trim()) && <p className="mt-1 text-sm text-ink-2">Paste a full link starting with https://.</p>}
          </div>
          <Attachments noteId={note.id} />
        </section>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this note?" description="Attachments stay in the backup.">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button type="button" className="btn-danger" onClick={() => void onDelete()}>
            Delete note
          </button>
        </div>
      </Modal>
    </article>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const t = raw.trim().replace(/^#/, "").toLowerCase().slice(0, 50);
    if (t && !tags.includes(t) && tags.length < 30) onChange([...tags, t]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={() => ref.current?.focus()}>
      {tags.map((t) => (
        <span key={t} className="pill bg-surface-2 py-0 pl-3 pr-0 text-[13px]">
          #{t}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-line"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
          >
            <CloseIcon size={14} />
          </button>
        </span>
      ))}
      <label htmlFor="note-tags" className="sr-only">
        Add a tag
      </label>
      <input
        ref={ref}
        id="note-tags"
        className="min-h-tap min-w-[8rem] flex-1 rounded-field bg-transparent px-2 text-sm placeholder:text-ink-2"
        placeholder={tags.length ? "Add tag" : "Add tags (Enter)"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}

function Attachments({ noteId }: { noteId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const files = useNoteFiles(noteId);
  const [busy, setBusy] = useState(false);

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 20 * 1024 * 1024) {
          toast(`${f.name} is over 20 MB.`);
          continue;
        }
        await uploadFile(qc, f, noteId);
      }
    } catch (e) {
      toast(restErrorText(e, "Uploading"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Attachments</p>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <UploadIcon size={18} /> {busy ? "Uploading…" : "Attach"}
          <input type="file" multiple className="sr-only" onChange={(e) => void onPick(e.target.files).then(() => (e.target.value = ""))} />
        </label>
      </div>
      {files.isError ? (
        <p className="text-sm text-ink-2">{restErrorText(files.error, "Attachments")}</p>
      ) : (files.data ?? []).length === 0 ? (
        <p className="text-sm text-ink-2">Images dropped into the note land here too.</p>
      ) : (
        <ul className="space-y-1">
          {(files.data ?? []).map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="link min-w-0 flex-1 truncate text-sm">
                {f.name}
              </a>
              <span className="tnum text-xs text-ink-2">{formatBytes(f.size)}</span>
              <a href={fileUrl(f.id)} download={f.name} className="icon-btn-sm" aria-label={`Download ${f.name}`}>
                <DownloadIcon size={18} />
              </a>
              <button
                type="button"
                className="icon-btn-sm"
                aria-label={`Remove ${f.name}`}
                onClick={() => void deleteFile(qc, f.id).catch((e: unknown) => toast(restErrorText(e, "Removing")))}
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
