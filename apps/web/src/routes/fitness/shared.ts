import { MICRO_INFO, type MealSlot, type MicroKey } from "@tatakae/core";

// Small shared bits for the Fitness tabs: number parsing/formatting, meal slots and macro colours.

export const MEALS: readonly { slot: MealSlot; label: string }[] = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "snack", label: "Snack" },
  { slot: "dinner", label: "Dinner" },
];

export const mealLabel = (slot: MealSlot): string => MEALS.find((m) => m.slot === slot)?.label ?? slot;

export { mealForTime } from "@tatakae/core";

/** Chart tones per macro: soft fill + deep edge (ink text sits on neither). */
export const MACRO_TONES = {
  protein: { fill: "#A9A3DB", deep: "#6E66B8" },
  carbs: { fill: "#B9CBF0", deep: "#4E6FB5" },
  fat: { fill: "#F4D978", deep: "#B38F12" },
  fibre: { fill: "#A3B56B", deep: "#6E7F35" },
} as const;

/** 1240 → "1,240". */
export const n0 = (n: number): string => Math.round(n).toLocaleString("en-US");

/** 84.24 → "84.2". */
export const n1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Parse a typed number ("1,240", " 2.5 ") → number, or null when empty or not a finite non-negative number. */
export function parseNum(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export { kgText, lastTimeText } from "@tatakae/core";

/** 430 minutes → "7 h 10 m". */
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m} m` : m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** Percent of a target, 0 when there is no target. */
export const pctOf = (value: number, target: number): number => (target > 0 ? Math.round((value / target) * 100) : 0);

/** "1.5 g" / "320 µg" with the unit defined once in core. */
export function microText(key: MicroKey, value: number | undefined): string {
  return value == null ? "—" : `${Number(value.toFixed(1))} ${MICRO_INFO[key].unit}`;
}
