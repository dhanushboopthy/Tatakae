import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";

/**
 * Soft lock: changing a forged plan needs a typed reason (min 3 characters). The reason travels with
 * the outbox item (meta.lockReason) and the server stores it as a mura event for Sunday's review.
 */
export function LockReasonDialog(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  /** What is about to change, e.g. "Change the title of P2". */
  summary?: string;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= 3;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      await props.onConfirm(reason.trim());
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="This plan is locked"
      description="You locked it at shutdown. Changing it is fine — note why, and it shows up in Sunday's review."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {props.summary && <p className="text-sm">{props.summary}</p>}
        <div>
          <label htmlFor="lock-reason" className="label">
            Why are you changing it?
          </label>
          <input
            id="lock-reason"
            className="input"
            autoFocus
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Internship deadline moved to today"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={props.onClose}>
            Keep the plan
          </button>
          <button type="submit" className="btn-primary" disabled={!ok || busy}>
            Change it
          </button>
        </div>
      </form>
    </Modal>
  );
}
