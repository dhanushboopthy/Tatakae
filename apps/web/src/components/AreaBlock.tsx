import type { CSSProperties, ReactNode } from "react";

/**
 * Pastel area block (docs/10 §5, ref 04/06): area colour fill with ink text, a darker tag pill, a title
 * and an optional time range. `planned` renders as an outlined block (dashed deep edge) instead.
 * `compact` (planner rail) puts the title first and the tag + time on one line under it, so a short
 * block still shows its title and only clips the details.
 */
export function AreaBlock(props: {
  tag: string;
  title: string;
  time?: string;
  fill: string;
  deep: string;
  planned?: boolean;
  compact?: boolean;
  /** Compact only: the block's height in px. Short blocks show a one-line title and drop the tag/time line. */
  heightPx?: number;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const h = props.heightPx ?? Infinity;
  const tag = (
    <span
      className="w-fit max-w-full shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: props.planned ? props.fill : "rgba(255,255,255,.55)", color: "#1C1C1E" }}
    >
      {props.tag}
    </span>
  );
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-[14px] text-on-accent ${props.compact ? "gap-0.5 px-2 py-1" : "gap-1 p-3"} ${props.className ?? ""}`}
      style={{
        background: props.planned ? "rgb(var(--surface))" : props.fill,
        border: props.planned ? `2px dashed ${props.deep}` : undefined,
        color: props.planned ? "rgb(var(--ink))" : undefined,
        ...props.style,
      }}
    >
      {props.compact ? (
        <>
          <span className={`shrink-0 text-xs font-semibold leading-tight ${h >= 64 ? "line-clamp-2" : "line-clamp-1"}`}>{props.title}</span>
          {h >= 44 && (
            <span className="flex min-w-0 shrink-0 items-center gap-1.5">
              {tag}
              {props.time && <span className="tnum truncate text-[11px] font-medium opacity-80">{props.time}</span>}
            </span>
          )}
        </>
      ) : (
        <>
          {tag}
          <span className="text-sm font-semibold leading-tight">{props.title}</span>
          {props.time && <span className="tnum text-[11px] font-medium opacity-80">{props.time}</span>}
        </>
      )}
      {props.children}
    </div>
  );
}
