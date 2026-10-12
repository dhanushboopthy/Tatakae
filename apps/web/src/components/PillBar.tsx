/** One long pill split into labelled parts (docs/11 C8), e.g. stuck: Uncertainty / Fear / Inertia. */
export function PillBar(props: {
  parts: readonly { label: string; value: number; fill: string; deep: string }[];
  label: string;
  empty?: string;
}) {
  const total = props.parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <p className="text-sm text-ink-2">{props.empty ?? "Nothing yet."}</p>;
  return (
    <div>
      <div role="img" aria-label={props.label} className="flex h-10 w-full gap-1 overflow-hidden rounded-full">
        {props.parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.label}
              className="flex h-full items-center justify-center text-sm font-semibold text-on-accent first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: p.value, background: p.fill, boxShadow: `inset 0 0 0 1.5px ${p.deep}` }}
            >
              <span className="tnum">{p.value}</span>
            </span>
          ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-hidden="true">
        {props.parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.fill, boxShadow: `inset 0 0 0 1.5px ${p.deep}` }} />
            {p.label} <span className="tnum font-semibold text-ink">{p.value}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
