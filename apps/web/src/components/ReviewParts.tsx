import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SegmentedPills } from "./SegmentedPills";

/** Week / Month switch shared by the review pages. */
export function ReviewSwitch({ value }: { value: "week" | "month" }) {
  const navigate = useNavigate();
  return (
    <SegmentedPills
      label="Review period"
      value={value}
      onChange={(v) => navigate(v === "week" ? "/review/week" : "/review/month")}
      options={[
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]}
    />
  );
}

/** Labelled multi-line field for review answers. */
export function ReviewField(props: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <textarea
        id={props.id}
        className="input min-h-[88px] resize-y"
        rows={props.rows ?? 3}
        maxLength={2000}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.hint}
      />
    </div>
  );
}

/** 0–10 scale as a row of 11 small pills (radio group). */
export function Scale(props: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; lowLabel: string; highLabel: string }) {
  return (
    <fieldset>
      <legend className="label">{props.label}</legend>
      <div role="radiogroup" aria-label={props.label} className="flex flex-wrap gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={props.value === n}
            onClick={() => props.onChange(props.value === n ? null : n)}
            className={`tnum inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
              props.value === n ? "bg-charcoal text-on-charcoal" : "bg-surface-2 hover:bg-line"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-ink-2">
        <span>{props.lowLabel}</span>
        <span>{props.highLabel}</span>
      </p>
    </fieldset>
  );
}

/** Muri / Mura / Muda step card: kanji-free label, the evidence, and the note field. */
export function StepCard(props: { step: string; title: string; question: string; children: ReactNode; tone: string }) {
  return (
    <section aria-label={props.title} className="card space-y-4">
      <div className="flex items-start gap-3">
        <span className={`pill ${props.tone} text-on-accent`}>{props.step}</span>
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="text-sm text-ink-2">{props.question}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}
