import type { CSSProperties, ReactNode } from "react";

/**
 * Pastel area block (docs/10 §5, ref 04/06): area colour fill with ink text, a darker tag pill, a title
 * and an optional time range. `planned` renders as an outlined block (dashed deep edge) instead.
 */
export function AreaBlock(props: {
  tag: string;
  title: string;
  time?: string;
  fill: string;
  deep: string;
  planned?: boolean;
  compact?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col gap-1 overflow-hidden rounded-[14px] text-on-accent ${props.compact ? "p-2" : "p-3"} ${props.className ?? ""}`}
      style={{
        background: props.planned ? "rgb(var(--surface))" : props.fill,
        border: props.planned ? `2px dashed ${props.deep}` : undefined,
        color: props.planned ? "rgb(var(--ink))" : undefined,
        ...props.style,
      }}
    >
      <span
        className="w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={{ background: props.planned ? props.fill : "rgba(255,255,255,.55)", color: "#1C1C1E" }}
      >
        {props.tag}
      </span>
      <span className={`font-semibold leading-tight ${props.compact ? "line-clamp-2 text-xs" : "text-sm"}`}>{props.title}</span>
      {props.time && <span className="tnum text-[11px] font-medium opacity-80">{props.time}</span>}
      {props.children}
    </div>
  );
}
