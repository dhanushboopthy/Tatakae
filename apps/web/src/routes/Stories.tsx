import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeTags, type InterviewStory } from "@tatakae/core";
import { EmptyState } from "../components/EmptyState";
import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { LibraryTabs } from "../components/LibraryTabs";
import { SceneCard } from "../components/SceneCard";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { useGoals } from "../lib/hooks";
import { restErrorText, storiesApi } from "../lib/rest";
import { Field } from "./Applications";

// Interview stories in STAR form (v3, REST only). Each card shows the title and the result; the four
// parts open in place so a story can be rehearsed straight from the list.

const PARTS = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

export function Stories() {
  const list = storiesApi.useList();
  const { data: goals = [] } = useGoals();
  const [editing, setEditing] = useState<InterviewStory | "new" | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const items = list.data ?? [];
  const tags = [...new Set(items.flatMap((s) => s.tags))].sort();
  const shown = tag ? items.filter((s) => s.tags.includes(tag)) : items;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Library"
        title="Stories"
        actions={
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add story
          </button>
        }
      />
      <LibraryTabs />
      <SceneCard scene="stories" className="max-w-read" />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`chip px-3 text-[13px] ${tag === t ? "bg-lime text-on-accent" : "bg-surface font-medium hover:bg-surface-2"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
      {list.isError ? (
        <EmptyState title="Stories didn't load." body={restErrorText(list.error, "Stories")} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={list.isLoading ? "Opening…" : "No stories yet."}
          body="Write the outage you fixed, the migration you led, the conflict you settled. Situation, task, action, result."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((s) => (
            <li key={s.id} className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{s.title}</p>
                  {s.goalId && <p className="text-sm text-ink-2">{goals.find((g) => g.id === s.goalId)?.name ?? "Goal"}</p>}
                </div>
                <button type="button" className="icon-btn-sm" aria-label={`Edit ${s.title}`} onClick={() => setEditing(s)}>
                  <PencilIcon size={18} />
                </button>
              </div>
              {s.result && (
                <p className="rounded-card-inner bg-lime-soft px-3 py-2 text-sm">
                  <span className="font-semibold">Result: </span>
                  {s.result}
                </p>
              )}
              <details>
                <summary className="flex min-h-tap cursor-pointer items-center text-sm font-semibold">Rehearse</summary>
                <dl className="space-y-2 text-sm">
                  {PARTS.map(([k, label]) => (
                    <div key={k}>
                      <dt className="font-semibold">{label}</dt>
                      <dd className="whitespace-pre-wrap text-ink-2">{s[k] || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              {s.tags.length > 0 && (
                <p className="flex flex-wrap gap-1.5 text-xs text-ink-2">
                  {s.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add story" : "Edit story"} wide>
        {editing !== null && <StoryForm story={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function StoryForm({ story, onDone }: { story: InterviewStory | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: goals = [] } = useGoals();
  const [title, setTitle] = useState(story?.title ?? "");
  const [parts, setParts] = useState({
    situation: story?.situation ?? "",
    task: story?.task ?? "",
    action: story?.action ?? "",
    result: story?.result ?? "",
  });
  const [tags, setTags] = useState(story?.tags.join(", ") ?? "");
  const [goalId, setGoalId] = useState(story?.goalId ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = {
      title: title.trim(),
      situation: parts.situation.trim() || null,
      task: parts.task.trim() || null,
      action: parts.action.trim() || null,
      result: parts.result.trim() || null,
      tags: normalizeTags(tags.split(",")),
      goalId: goalId || null,
    };
    try {
      if (story) await storiesApi.update(qc, story.id, body);
      else await storiesApi.create(qc, body);
      onDone();
    } catch (err) {
      toast(restErrorText(err, "Saving"));
    }
  }

  async function onDelete() {
    if (!story) return;
    try {
      await storiesApi.remove(qc, story.id);
      onDone();
    } catch (err) {
      toast(restErrorText(err, "Deleting"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field id="st-title" label="Title">
        <input id="st-title" className="input" autoFocus required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {PARTS.map(([k, label]) => (
        <Field key={k} id={`st-${k}`} label={label}>
          <textarea
            id={`st-${k}`}
            className="input min-h-[72px] py-3"
            maxLength={3000}
            value={parts[k]}
            onChange={(e) => setParts((p) => ({ ...p, [k]: e.target.value }))}
          />
        </Field>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="st-tags" label="Tags (comma separated)">
          <input id="st-tags" className="input" value={tags} placeholder="incident, leadership" onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field id="st-goal" label="Goal">
          <select id="st-goal" className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {story && (
          <button type="button" className="btn-ghost" onClick={() => void onDelete()}>
            <TrashIcon size={18} /> Delete
          </button>
        )}
        <span className="flex-1" />
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!title.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}
