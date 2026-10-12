import type { MetricBox, MetricKey } from "@tatakae/core";
import { MetricCard } from "./MetricCard";

const LINKS: Partial<Record<MetricKey, string>> = {
  days_shown_up: "/cycle",
  avg_7d: "/review/week",
  p1_hit_rate: "/review/month",
  focus_week: "/calendar",
  habits_week: "/review/month",
  inbox: "/inbox",
};

/** A row of scoreboard boxes (docs/11 §2). Web Dashboard shows four. */
export function Scoreboard(props: { boxes: readonly MetricBox[]; keys: readonly MetricKey[]; className?: string }) {
  const picked = props.keys.map((k) => props.boxes.find((b) => b.key === k)).filter((b): b is MetricBox => b !== undefined);
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${props.className ?? ""}`}>
      {picked.map((b, i) => (
        <MetricCard key={b.key} box={b} to={LINKS[b.key]} bar={i % 2 === 1 ? "lavender" : "lime"} />
      ))}
    </div>
  );
}
