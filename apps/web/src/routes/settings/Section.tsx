import type { ReactNode } from "react";

/** One settings card with an anchor id, a title and an optional one-line description. */
export function Section(props: { id: string; title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-title`} className="card scroll-mt-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${props.id}-title`} className="text-xl font-semibold">
            {props.title}
          </h2>
          {props.description && <p className="mt-1 text-sm text-ink-2">{props.description}</p>}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

/** A row: label on the left, control on the right (stacks on narrow screens). */
export function Row(props: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,260px)] sm:items-center">
      <div>
        <label htmlFor={props.htmlFor} className="font-medium">
          {props.label}
        </label>
        {props.hint && <p className="text-sm text-ink-2">{props.hint}</p>}
      </div>
      <div className="sm:justify-self-end">{props.children}</div>
    </div>
  );
}

/** Pill switch (role="switch"), 44 px target. */
export function Toggle(props: { id?: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      onClick={() => props.onChange(!props.checked)}
      className="inline-flex min-h-tap items-center"
    >
      <span className={`relative inline-block h-7 w-12 rounded-full transition ${props.checked ? "bg-lime-deep" : "bg-missed"}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-base ${props.checked ? "left-6" : "left-1"}`}
        />
      </span>
      <span className="ml-2 text-sm font-medium">{props.checked ? "On" : "Off"}</span>
    </button>
  );
}
