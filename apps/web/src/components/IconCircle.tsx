import type { ReactNode } from "react";

/** 48 px circle holding an icon (docs/10 §5): neutral (surface-2), primary (charcoal), soft (lavender-soft), lime. */
export function IconCircle(props: {
  children: ReactNode;
  variant?: "neutral" | "primary" | "soft" | "lime";
  size?: 40 | 44 | 48 | 56 | 64;
  className?: string;
}) {
  const v = props.variant ?? "neutral";
  const tone =
    v === "primary"
      ? "bg-charcoal text-on-charcoal"
      : v === "soft"
        ? "bg-lavender-soft text-ink"
        : v === "lime"
          ? "bg-lime text-on-accent"
          : "bg-surface-2 text-ink";
  const s = props.size ?? 48;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${tone} ${props.className ?? ""}`}
      style={{ width: s, height: s }}
    >
      {props.children}
    </span>
  );
}
