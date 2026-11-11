import type { Area, CalendarState, WeekMark } from "@tatakae/core";
import type { Palette } from "../theme";

// Colour lookups for charts and calendar (docs/10 §2, docs/11), same values as the website's
// lib/colors.ts. Fills carry ink text; marks on white use the deep variant (≥ 3:1). Never red.

export const AREA_COLORS = {
  sage: { fill: "#A3B56B", deep: "#6E7F35", label: "Sage" },
  rose: { fill: "#F7A8D3", deep: "#C2508F", label: "Rose" },
  butter: { fill: "#F4D978", deep: "#B38F12", label: "Butter" },
  sky: { fill: "#B9CBF0", deep: "#4E6FB5", label: "Sky" },
  "lime-soft": { fill: "#EEF5D3", deep: "#7E9A1E", label: "Lime" },
  "lavender-soft": { fill: "#E9E7F8", deep: "#6E66B8", label: "Lavender" },
} as const;

export type AreaColorKey = keyof typeof AREA_COLORS;
export const AREA_COLOR_KEYS = Object.keys(AREA_COLORS) as AreaColorKey[];

export const UNASSIGNED = { fill: "#E6E6E3", deep: "#8A8A90", label: "Unassigned" } as const;

export function isAreaColor(v: string | null | undefined): v is AreaColorKey {
  return v != null && v in AREA_COLORS;
}

/** Colour of an area: its own `color`, else a stable default by position. */
export function areaColor(area: Pick<Area, "color"> | null | undefined, index = 0): { fill: string; deep: string } {
  if (!area) return UNASSIGNED;
  if (isAreaColor(area.color)) return AREA_COLORS[area.color];
  return AREA_COLORS[AREA_COLOR_KEYS[index % 4] ?? "sage"];
}

/** Display word for a calendar state (screen readers, legends). */
export const STATE_LABEL: Record<CalendarState, string> = {
  Strong: "Strong",
  Solid: "Solid",
  Light: "Light",
  Unplanned: "Nothing planned",
  Missed: "Missed",
  Rest: "Rest day",
  WriteOff: "Written off",
  Future: "Ahead",
  Today: "Today",
};

/** Gauge / week-mark segment fill + stroke. */
export function markFill(mark: WeekMark, c: Palette): { fill: string; stroke: string } {
  switch (mark) {
    case "Strong":
      return { fill: c.lime, stroke: c.limeDeep };
    case "Solid":
      return { fill: c.lavender, stroke: c.lavenderDeep };
    case "Light":
      return { fill: c.limeSoft, stroke: c.limeDeep };
    case "Missed":
      return { fill: c.surface2, stroke: c.missed };
    default:
      return { fill: "transparent", stroke: c.line };
  }
}
