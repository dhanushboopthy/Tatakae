import { useRef, useState, type FormEvent } from "react";
import { storyPack, themeFor, type StoryMoment, type WatchQueueItem } from "@tatakae/core";
import { TrashIcon, UploadIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { importStoryPack, removeWatch, saveSetting, saveWatch, setStoryMuted, useSettings, useStoryRefs, useToday, useWatchQueue } from "../../lib/hooks";
import { storyLine } from "../../lib/story";
import { Row, Section, Toggle } from "./Section";

// Story layer settings (docs/02 story layer, docs/05): on/off, reference pack import (validated: your own
// paraphrase ≤ 160 chars, known moments), muted refs, and the reward watch queue. The pack file stays on
// this laptop (references/*.local.json is git-ignored); only the parsed lines sync.

const MOMENTS: Record<StoryMoment, string> = {
  p1_done: "P1 done",
  minimum_done: "Minimum done",
  comeback: "Comeback",
  stuck_fear: "Stuck: fear",
  stuck_inertia: "Stuck: inertia",
  weekly_review: "Weekly review",
  cycle_start: "Cycle start",
  rest_day: "Rest day",
};

export function StorySettings() {
  const { data: s, isPlaceholderData } = useSettings();
  const { data: refs = [] } = useStoryRefs();
  const today = useToday();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFile(f: File) {
    setErrors([]);
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch {
      setErrors(["That file isn't valid JSON."]);
      return;
    }
    const parsed = storyPack.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "file"}: ${i.message}`));
      return;
    }
    const added = await importStoryPack(parsed.data);
    toast(added ? `Imported ${added} lines.` : "Nothing new in that pack.");
  }

  const muted = refs.filter((r) => r.muted);
  const byMoment = Object.entries(MOMENTS).map(([m, label]) => [label, refs.filter((r) => r.moment === m && !r.muted).length] as const);
  const theme = themeFor(today);

  return (
    <Section
      id="story"
      title="Story"
      description="One paraphrased line after about one in three completions. Never in notifications, never on the morning screen."
    >
      {s && !isPlaceholderData && (
        <Row label="Story lines" hint={theme ? `This month's theme: ${theme}.` : undefined}>
          <Toggle label="Story lines" checked={s.story_enabled} onChange={(v) => void saveSetting("story_enabled", v)} />
        </Row>
      )}
      <div className="card-inner space-y-3 text-sm">
        <p className="font-semibold">Reference pack</p>
        <p className="text-ink-2">
          Titles and character names with your own paraphrase only — no quotes, art, logos or audio. Each lesson ≤ 160 characters. Format:{" "}
          <code className="rounded bg-surface px-1">{'{ "version": 1, "refs": [{ title, medium, character, lesson, moment, yourLine }] }'}</code>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="story-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <label htmlFor="story-file" className="btn-primary cursor-pointer">
            <UploadIcon size={18} /> Import pack
          </label>
          <span className="tnum text-ink-2">{refs.length} lines</span>
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {refs.length > 0 && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-ink-2">
            {byMoment.map(([label, n]) => (
              <span key={label}>
                {label} <span className="tnum font-semibold text-ink">{n}</span>
              </span>
            ))}
          </p>
        )}
      </div>

      {muted.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Muted</p>
          <ul className="space-y-1.5">
            {muted.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-card-inner bg-surface-2 py-1.5 pl-4 pr-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{storyLine(r)}</span>
                <button type="button" className="btn min-h-tap bg-surface px-3 text-sm" onClick={() => void setStoryMuted(r, false)}>
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WatchQueue />
    </Section>
  );
}

function WatchQueue() {
  const { data: items = [] } = useWatchQueue();
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || items.some((i) => i.title === title.trim())) return;
    const n = Number.parseInt(total, 10);
    await saveWatch({ title: title.trim(), totalEpisodes: Number.isFinite(n) && n > 0 ? n : null, watched: 0, unlocked: 0, status: "queued" });
    setTitle("");
    setTotal("");
  }

  const bump = (w: WatchQueueItem, patch: Partial<WatchQueueItem>) => void saveWatch({ ...w, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Reward queue</p>
        <p className="text-sm text-ink-2">Each completed weekly review unlocks one episode of the next show. A light nudge, not a currency.</p>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((w) => (
            <li key={w.title} className="flex flex-wrap items-center gap-3 rounded-card-inner bg-surface-2 py-1.5 pl-4 pr-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{w.title}</span>
              <span className="tnum text-ink-2">
                {w.watched}/{w.totalEpisodes ?? "?"} watched · {Math.max(0, w.unlocked - w.watched)} unlocked
              </span>
              <button
                type="button"
                className="btn min-h-tap bg-surface px-3 text-sm"
                disabled={w.unlocked <= w.watched}
                onClick={() => bump(w, { watched: w.watched + 1, status: w.totalEpisodes && w.watched + 1 >= w.totalEpisodes ? "done" : "watching" })}
              >
                Watched one
              </button>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Remove ${w.title}`} onClick={() => void removeWatch(w.title)}>
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <label htmlFor="wq-title" className="sr-only">
          Show
        </label>
        <input id="wq-title" className="input max-w-xs" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Show title" />
        <label htmlFor="wq-total" className="sr-only">
          Episodes
        </label>
        <input id="wq-total" className="input tnum w-28" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d]/g, ""))} placeholder="Episodes" />
        <button type="submit" className="btn-secondary" disabled={!title.trim()}>
          Add show
        </button>
      </form>
    </div>
  );
}
