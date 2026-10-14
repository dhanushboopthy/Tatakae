import { useState, type FormEvent } from "react";
import type { WatchQueueItem } from "@tatakae/core";
import { TrashIcon } from "../../components/icons";
import { removeWatch, saveWatch, useWatchQueue } from "../../lib/hooks";

// Reward queue (docs/02 weekly review): each completed weekly review unlocks one episode of the next
// show. Moved here from the removed Settings → Story section (R3-10); shown inside Settings → General.

export function RewardQueue() {
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
    <div className="space-y-3 border-t border-line pt-4">
      <div>
        <p className="font-medium">Reward queue</p>
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
