import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { capture, setStatus, useDay, useToday } from "../lib/hooks";
import { useToast } from "./Toast";

/** Cmd/Ctrl+K: capture, go to screens, start focus on P1, mark P1 done. Laptop only. */

const OPEN_EVENT = "tatakae:palette";

/** Open the palette from anywhere (e.g. the sidebar button). */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

const SCREENS: readonly [string, string][] = [
  ["Today", "/today"],
  ["Calendar", "/calendar"],
  ["Night ritual", "/ritual"],
  ["Inbox", "/inbox"],
  ["Capture", "/capture"],
  ["Focus", "/focus"],
  ["Weekly review", "/review/week"],
  ["Monthly review", "/review/month"],
  ["Cycle", "/cycle"],
  ["Notes", "/notes"],
  ["Applications", "/applications"],
  ["Interview stories", "/stories"],
  ["Japanese log", "/japanese"],
  ["Settings", "/settings"],
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-card bg-surface p-0 text-ink shadow-float"
    >
      {open && <PaletteBody onClose={close} />}
    </dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();
  const { data: day } = useDay(today);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const p1 = day?.slots.P1;
  const commands = useMemo<Command[]>(() => {
    const q = query.trim();
    const out: Command[] = [];
    if (q) {
      out.push({
        id: "capture",
        label: `Capture “${q}”`,
        hint: "to inbox",
        run: async () => {
          await capture(q);
          toast("Saved to inbox.");
        },
      });
    }
    if (p1 && p1.status !== "done" && p1.status !== "rescheduled") {
      out.push({ id: "focus-p1", label: `Start focus on P1: ${p1.title}`, run: () => navigate(`/focus?mission=${encodeURIComponent(p1.id)}`) });
      out.push({
        id: "done-p1",
        label: `Mark P1 done: ${p1.title}`,
        run: async () => {
          await setStatus(p1, "done");
          toast("P1 done.");
        },
      });
    }
    for (const [label, path] of SCREENS) out.push({ id: `go-${path}`, label: `Go to ${label}`, run: () => navigate(path) });
    if (!q) return out;
    const needle = q.toLowerCase();
    return out.filter((c) => c.id === "capture" || c.label.toLowerCase().includes(needle));
  }, [query, p1, navigate, toast]);

  const safeActive = Math.min(active, Math.max(0, commands.length - 1));

  async function run(c: Command | undefined) {
    if (!c) return;
    onClose();
    await c.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((safeActive + 1) % Math.max(1, commands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((safeActive - 1 + commands.length) % Math.max(1, commands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void run(commands[safeActive]);
    }
  }

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Type a command or something to capture
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={commands[safeActive] ? `${listId}-${safeActive}` : undefined}
        autoFocus
        autoComplete="off"
        className="min-h-[64px] w-full rounded-t-card border-b border-line bg-transparent px-6 text-lg placeholder:text-ink-2 focus-visible:outline-none"
        placeholder="Capture a thought, or jump somewhere…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label="Commands" className="max-h-[50vh] overflow-y-auto p-2">
        {commands.map((c, i) => (
          <li
            key={c.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === safeActive}
            onMouseEnter={() => setActive(i)}
            onClick={() => void run(c)}
            className={`flex min-h-tap cursor-pointer items-center justify-between gap-4 rounded-full px-4 ${
              i === safeActive ? "bg-lime font-semibold text-on-accent" : ""
            }`}
          >
            <span className="truncate">{c.label}</span>
            {c.hint && <span className={`shrink-0 text-sm ${i === safeActive ? "" : "text-ink-2"}`}>{c.hint}</span>}
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-6 py-3 text-xs text-ink-2">
        <span className="kbd">↑</span> <span className="kbd">↓</span> to move · <span className="kbd">Enter</span> to run ·{" "}
        <span className="kbd">Esc</span> to close
      </p>
    </div>
  );
}
