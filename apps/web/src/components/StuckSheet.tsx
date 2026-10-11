import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Blocker, Mission } from "@tatakae/core";
import { logStuck } from "../lib/hooks";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/**
 * Stuck: three big choices → one follow-up field or a timer (≤ 15 s). Writes a stuck_events row.
 * Uncertainty → next physical action. Fear → 10/10/10 + act as if confident. Inertia → 5-minute timer now.
 */

const CHOICES: readonly { blocker: Blocker; title: string; body: string }[] = [
  { blocker: "uncertainty", title: "Not sure what to do", body: "Uncertainty. Name the next physical action." },
  { blocker: "fear", title: "Worried it won't go well", body: "Fear. Shrink it with 10 / 10 / 10." },
  { blocker: "inertia", title: "Can't get started", body: "Inertia. Start a 5-minute timer now." },
];

export function StuckSheet(props: { mission: Mission; open: boolean; onClose: () => void }) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Stuck?" description={props.mission.title}>
      <StuckBody mission={props.mission} onClose={props.onClose} />
    </Modal>
  );
}

function StuckBody({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [text, setText] = useState("");

  async function pick(b: Blocker) {
    if (b === "inertia") {
      await logStuck(mission.id, "inertia", "5-minute timer");
      onClose();
      navigate(`/focus?mission=${encodeURIComponent(mission.id)}&min=5`);
      return;
    }
    setBlocker(b);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!blocker) return;
    await logStuck(mission.id, blocker, text);
    onClose();
    toast(blocker === "uncertainty" ? "Next action noted. Do just that." : "Noted. Act as if it'll go fine.");
  }

  if (!blocker) {
    return (
      <div className="grid gap-3">
        {CHOICES.map((c) => (
          <button
            key={c.blocker}
            type="button"
            onClick={() => void pick(c.blocker)}
            className="flex min-h-[72px] flex-col items-start justify-center rounded-card border border-line-strong bg-ink-3 px-4 py-3 text-left hover:border-paper"
          >
            <span className="font-medium">{c.title}</span>
            <span className="text-sm text-muted">{c.body}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {blocker === "fear" && (
        <ul className="space-y-1 text-sm text-muted">
          <li>How much will this matter in 10 minutes?</li>
          <li>In 10 months?</li>
          <li>In 10 years?</li>
        </ul>
      )}
      <div>
        <label htmlFor="stuck-text" className="label">
          {blocker === "uncertainty" ? "What's the next physical action?" : "If you were confident, what would you do first?"}
        </label>
        <input
          id="stuck-text"
          className="input"
          autoFocus
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={blocker === "uncertainty" ? "e.g. Open the Terraform docs on modules" : "e.g. Send the draft as it is"}
        />
      </div>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={() => setBlocker(null)}>
          Back
        </button>
        <button type="submit" className="btn-primary">
          Save and go
        </button>
      </div>
    </form>
  );
}
