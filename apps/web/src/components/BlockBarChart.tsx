/**
 * Block bar chart (docs/11 C6, ref 05): columns of rounded blocks stacked bottom-up, one block per
 * `unit` (e.g. 30 focus minutes), coloured per series (area pastels with a deep edge). Series are
 * labelled directly in a legend with numbers — never colour alone.
 */

export interface BlockSeries {
  key: string;
  label: string;
  fill: string;
  deep: string;
}

export function BlockBarChart(props: {
  columns: readonly { label: string; values: Record<string, number> }[];
  series: readonly BlockSeries[];
  unit: number;
  unitLabel: string;
  label: string;
  maxBlocks?: number;
}) {
  const blocks = props.columns.map((col) =>
    props.series.flatMap((s) => Array.from({ length: Math.ceil((col.values[s.key] ?? 0) / props.unit) }, () => s)),
  );
  const tallest = Math.max(1, Math.min(props.maxBlocks ?? 12, ...blocks.map((b) => b.length)));
  return (
    <figure className="m-0">
      <div role="img" aria-label={props.label} className="flex items-end gap-2 overflow-x-auto pb-1">
        {blocks.map((stack, i) => (
          <div key={props.columns[i]?.label ?? i} className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-col-reverse gap-1" style={{ height: tallest * 22 }}>
              {stack.slice(0, tallest).map((s, k) => (
                <span key={k} className="h-[18px] w-full rounded-md" style={{ background: s.fill, boxShadow: `inset 0 0 0 1.5px ${s.deep}` }} />
              ))}
            </div>
            <span className="text-[13px] font-medium text-ink-2">{props.columns[i]?.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {props.series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded" style={{ background: s.fill, boxShadow: `inset 0 0 0 1.5px ${s.deep}` }} />
            {s.label}
          </span>
        ))}
        <span>· one block = {props.unitLabel}</span>
      </figcaption>
    </figure>
  );
}

/** Single-row count blocks (docs/11 C9): e.g. Strong 6 · Solid 9 · Light 4 · Missed 3 · Rest 4. */
export function CountBlocks(props: {
  items: readonly { label: string; count: number; fill: string; deep: string; hatch?: boolean }[];
  label: string;
}) {
  return (
    <ul aria-label={props.label} className="space-y-2">
      {props.items.map((it) => (
        <li key={it.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-sm font-medium">{it.label}</span>
          <span className="flex flex-1 flex-wrap gap-1" aria-hidden="true">
            {Array.from({ length: it.count }, (_, k) => (
              <span
                key={k}
                className={`h-5 w-5 rounded-md ${it.hatch ? "hatch-missed" : ""}`}
                style={{ background: it.hatch ? undefined : it.fill, boxShadow: `inset 0 0 0 1.5px ${it.deep}` }}
              />
            ))}
          </span>
          <span className="tnum w-8 text-right text-sm font-semibold">{it.count}</span>
        </li>
      ))}
    </ul>
  );
}
