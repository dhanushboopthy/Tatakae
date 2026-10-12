import { useEffect, useState, type FormEvent } from "react";
import { capture } from "../lib/hooks";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

// Quick capture (docs/05: one autofocused field, Save, ≤ 5 s, no categorising). Opened from the "+"
// circle in page headers via openCapture(), or with the "c" key outside text fields.

const OPEN_EVENT = "tatakae:capture";

export function openCapture(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CaptureDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === "c" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Capture" description="Anything. Sort it later in the inbox.">
      <CaptureForm onDone={() => setOpen(false)} />
    </Modal>
  );
}

export function CaptureForm(props: { onDone?: () => void; initial?: string }) {
  const toast = useToast();
  const [text, setText] = useState(props.initial ?? "");
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const item = await capture(text);
    if (!item) return;
    setText("");
    toast("Saved to inbox.");
    props.onDone?.();
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="capture-text" className="sr-only">
        What's on your mind?
      </label>
      <input
        id="capture-text"
        className="input min-h-[52px] flex-1 text-lg"
        autoFocus
        autoComplete="off"
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind?"
      />
      <button type="submit" className="btn-primary min-h-[52px]" disabled={!text.trim()}>
        Save
      </button>
    </form>
  );
}
