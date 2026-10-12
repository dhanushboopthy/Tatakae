import { useEffect, useRef, useState, type FormEvent } from "react";
import { addDays, type ISODate, type InboxItem, type Slot } from "@tatakae/core";
import { CaptureForm } from "../components/CaptureDialog";
import { EmptyState } from "../components/EmptyState";
import { InboxIcon, NoteIcon, PencilIcon, TrashIcon } from "../components/icons";
import { LockReasonDialog } from "../components/LockReasonDialog";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { api, isNetworkError } from "../lib/api";
import { appDayAge } from "../lib/format";
import { discardInbox, editInbox, markProcessed, restoreInbox, upsertMission, useDay, useInbox, useToday } from "../lib/hooks";
import { AFTER_P1, firstFreeSlot } from "../lib/plan";
import { flushNow } from "../sync/engine";

// Inbox (docs/05): captured items → mission (backlog / today / tomorrow), note, or discard.
// Keyboard: j / k move, m mission, n note, x discard, e edit. Inbox zero is a calm empty state.

export function Inbox() {
  const { data: items = [], isLoading } = useInbox();
  const toast = useToast();
  const [active, setActive] = useState(0);
  const [toMission, setToMission] = useState<InboxItem | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const safe = Math.min(active, Math.max(0, items.length - 1));
  const current = items[safe];

  async function toNote(item: InboxItem) {
    try {
      await flushNow(); // the item must exist on the server first
      await api(`/inbox/${encodeURIComponent(item.id)}`, { method: "PATCH", body: { to: "note" } });
      await markProcessed(item);
      toast("Saved as a note.");
    } catch (e) {
      toast(isNetworkError(e) ? "Notes need a connection. Try again when you're online." : "Couldn't make a note. Try again.");
    }
  }

  async function discard(item: InboxItem) {
    await discardInbox(item);
    toast("Discarded.", {
      action: {
        label: "Undo",
        onClick: () => void restoreInbox(item),
      },
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      if (!current) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") setActive(Math.min(items.length - 1, safe + 1));
      else if (k === "k" || e.key === "ArrowUp") setActive(Math.max(0, safe - 1));
      else if (k === "m") setToMission(current);
      else if (k === "n") void toNote(current);
      else if (k === "x") void discard(current);
      else if (k === "e") setEditing(current.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safe}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safe]);

  return (
    <div className="page-read">
      <PageHeader eyebrow="Inbox" title={items.length ? `${items.length} to sort` : "Inbox"} quiet />

      <section className="card">
        <CaptureForm />
      </section>

      {isLoading ? null : items.length === 0 ? (
        <EmptyState icon={<InboxIcon />} title="Inbox zero." body="Capture anything with one tap — the + in any header, or press c." />
      ) : (
        <>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2">
            <span>
              <span className="kbd">j</span> <span className="kbd">k</span> move
            </span>
            <span>
              <span className="kbd">m</span> mission
            </span>
            <span>
              <span className="kbd">n</span> note
            </span>
            <span>
              <span className="kbd">x</span> discard
            </span>
            <span>
              <span className="kbd">e</span> edit
            </span>
          </p>
          <ul ref={listRef} className="space-y-2" aria-label="Inbox items">
            {items.map((item, i) => (
              <li
                key={item.id}
                data-index={i}
                aria-current={i === safe ? "true" : undefined}
                onClick={() => setActive(i)}
                className={`rounded-card-inner bg-surface p-4 transition ${i === safe ? "ring-2 ring-lime-deep" : ""}`}
              >
                {editing === item.id ? (
                  <EditItem
                    item={item}
                    onDone={() => {
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words font-medium">{item.text}</p>
                      <p className="mt-1 text-xs text-ink-2">{appDayAge(item.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className="chip bg-lime py-2 text-on-accent" onClick={() => setToMission(item)}>
                        Mission
                      </button>
                      <button type="button" className="icon-btn-sm" aria-label={`Make a note: ${item.text}`} onClick={() => void toNote(item)}>
                        <NoteIcon size={18} />
                      </button>
                      <button type="button" className="icon-btn-sm" aria-label={`Edit: ${item.text}`} onClick={() => setEditing(item.id)}>
                        <PencilIcon size={18} />
                      </button>
                      <button type="button" className="icon-btn-sm" aria-label={`Discard: ${item.text}`} onClick={() => void discard(item)}>
                        <TrashIcon size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <ToMissionDialog item={toMission} onClose={() => setToMission(null)} />
    </div>
  );
}

function EditItem({ item, onDone }: { item: InboxItem; onDone: () => void }) {
  const [text, setText] = useState(item.text);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await editInbox(item, text);
    onDone();
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <label htmlFor={`edit-${item.id}`} className="sr-only">
        Edit item
      </label>
      <input
        id={`edit-${item.id}`}
        className="input"
        autoFocus
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      />
      <button type="submit" className="btn-primary">
        Save
      </button>
    </form>
  );
}

type Target = "backlog" | "today" | "tomorrow";

function ToMissionDialog({ item, onClose }: { item: InboxItem | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title="Make it a mission" description={item?.text}>
      {item && <ToMissionForm item={item} onClose={onClose} />}
    </Modal>
  );
}

function ToMissionForm({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const toast = useToast();
  const { data: todayView } = useDay(today);
  const { data: tomorrowView } = useDay(tomorrow);
  const [title, setTitle] = useState(item.text.slice(0, 200));
  const [target, setTarget] = useState<Target>("backlog");
  const [needReason, setNeedReason] = useState(false);

  const view = target === "today" ? todayView : target === "tomorrow" ? tomorrowView : null;
  const slot: Slot | null = view ? firstFreeSlot(view.missions, AFTER_P1) : "backlog";
  const date: ISODate | null = target === "today" ? today : target === "tomorrow" ? tomorrow : null;

  async function save(reason?: string) {
    if (!slot) return;
    await upsertMission({ title: title.trim(), dayDate: date, slot }, reason ? { lockReason: reason } : undefined);
    await markProcessed(item);
    toast(date ? `Added as ${slot === "side" ? "side quest" : slot} for ${target}.` : "Moved to the backlog.");
    onClose();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slot) return;
    if (view?.forged) setNeedReason(true);
    else void save();
  }

  const options: { value: Target; label: string }[] = [
    { value: "backlog", label: "Backlog" },
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="tm-title" className="label">
          Title
        </label>
        <input id="tm-title" className="input" autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <fieldset>
        <legend className="label">Where</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={target === o.value}
              onClick={() => setTarget(o.value)}
              className={`chip ${target === o.value ? "bg-lime text-on-accent" : "bg-surface-2 font-medium hover:bg-line"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {target === "backlog"
            ? "Pick it up in a ritual or the week planner."
            : slot
              ? `Goes in as ${slot === "side" ? "the side quest" : slot}.${view?.forged ? " That plan is locked, so you'll note why." : ""}`
              : "That day already has nine missions and a side quest. Use the backlog."}
        </p>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!title.trim() || !slot}>
          Make mission
        </button>
      </div>
      <LockReasonDialog
        open={needReason}
        summary={`Add "${title.trim()}" to ${target}'s locked plan`}
        onClose={() => setNeedReason(false)}
        onConfirm={async (reason) => {
          setNeedReason(false);
          await save(reason);
        }}
      />
    </form>
  );
}
