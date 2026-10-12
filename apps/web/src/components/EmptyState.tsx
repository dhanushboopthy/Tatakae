import type { ReactNode } from "react";

/** Quiet empty state: one line of calm copy, optional body and one action. */
export function EmptyState(props: { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card bg-surface p-6">
      {props.icon && <div className="icon-btn pointer-events-none mb-1">{props.icon}</div>}
      <p className="text-lg font-semibold">{props.title}</p>
      {props.body && <div className="text-sm text-ink-2">{props.body}</div>}
      {props.action && <div className="mt-2">{props.action}</div>}
    </div>
  );
}
