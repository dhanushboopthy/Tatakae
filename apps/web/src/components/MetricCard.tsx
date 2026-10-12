import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { MetricBox } from "@tatakae/core";
import { OpenIcon } from "./icons";

/**
 * Scoreboard box (docs/10 §5, docs/11 §2): label + corner icon, hero number with a small delta pill
 * (lime ↗ better, grey ↘ worse — never red), one context line, thin progress bar with % at the right.
 */
export function MetricCard(props: {
  box: MetricBox;
  /** Corner link (↗) to the screen behind the number. */
  to?: string;
  icon?: ReactNode;
  bar?: "lime" | "lavender";
  size?: "md" | "lg";
  children?: ReactNode;
  className?: string;
}) {
  const { box } = props;
  const value = box.value == null ? "—" : box.unit === "%" ? `${box.value}%` : String(box.value);
  return (
    <section aria-labelledby={`metric-${box.key}`} className={`card flex flex-col gap-2.5 ${props.className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`metric-${box.key}`} className="text-base font-semibold">
          {box.label}
        </h3>
        {props.to ? (
          <Link to={props.to} className="icon-btn-sm" aria-label={`Open ${box.label}`}>
            <OpenIcon size={18} />
          </Link>
        ) : props.icon ? (
          <span className="icon-btn-sm pointer-events-none" aria-hidden="true">
            {props.icon}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`tnum ${props.size === "lg" ? "text-hero" : "text-hero-sm"}`}>{value}</span>
        {box.unit === "min" && box.value != null && <span className="text-sm font-medium text-ink-2">min</span>}
        <DeltaPill delta={box.delta} unit={box.unit} />
      </div>
      <p className="text-sm text-ink-2">{box.context}</p>
      {props.children}
      {box.progress != null && <ProgressBar pct={box.progress} tone={props.bar ?? "lime"} label={box.label} />}
    </section>
  );
}

export function DeltaPill({ delta, unit }: { delta: number | null; unit?: MetricBox["unit"] }) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const suffix = unit === "%" ? "%" : unit === "min" ? " min" : "";
  return (
    <span className={`pill tnum ${up ? "bg-lime text-on-accent" : "bg-surface-2 text-ink-2"}`}>
      <span aria-hidden="true">{up ? "↗" : "↘"}</span>
      <span className="sr-only">{up ? "up" : "down"}</span>
      {up ? "+" : "−"}
      {Math.abs(delta)}
      {suffix}
    </span>
  );
}

export function ProgressBar({ pct, tone = "lime", label }: { pct: number; tone?: "lime" | "lavender"; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="mt-auto flex items-center gap-3 pt-1">
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        className="h-2 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${p}%`,
            background: tone === "lime" ? "linear-gradient(90deg, #7E9A1E, #A6C23A)" : "#6E66B8",
          }}
        />
      </div>
      <span className="tnum w-11 text-right text-[15px] font-semibold" aria-hidden="true">
        {p}%
      </span>
    </div>
  );
}
