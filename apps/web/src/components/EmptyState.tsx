import type { ReactNode } from "react";

/** Quiet empty state: one line of calm copy, optional body and one action. */
export function EmptyState(props: { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-legacy-card border border-dashed border-legacy-line-strong p-6">
      {props.icon && <div className="text-legacy-muted">{props.icon}</div>}
      <p className="font-medium">{props.title}</p>
      {props.body && <div className="text-sm text-legacy-muted">{props.body}</div>}
      {props.action && <div className="mt-2">{props.action}</div>}
    </div>
  );
}
