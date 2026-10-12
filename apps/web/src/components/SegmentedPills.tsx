/** Segmented pills (docs/10 §5): Day / Week / Month style; selected = lime fill, others surface-2. */
export function SegmentedPills<T extends string>(props: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} className="flex flex-wrap gap-1.5">
      {props.options.map((o) => {
        const on = o.value === props.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => props.onChange(o.value)}
            className={`chip px-4 py-2 text-[13px] ${on ? "bg-lime text-on-accent" : "bg-surface-2 font-medium text-ink hover:bg-line"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
