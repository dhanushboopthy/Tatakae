import { useEffect, useSyncExternalStore } from "react";
import { istTimeHHMM } from "@tatakae/core";
import { storage } from "./storage";

// Light "Soft Bento" by day, dark from ritual time to wake time (docs/10 §2). Per-device preference
// (auto / light / dark) lives in localStorage; the night ritual forces dark while it is open.

export type ThemePref = "auto" | "light" | "dark";

const PREF_KEY = "tatakae.theme";
const LAST_KEY = "tatakae.theme.last"; // last applied mode, for the first paint
const THEME_COLOR = { light: "#F1F1EF", dark: "#0E0E10" } as const;

/** True when `now` ("HH:MM", IST) is between ritual time and wake time (wrapping past midnight). */
export function isNightTime(now: string, ritualTime: string, wakeTime: string): boolean {
  if (ritualTime === wakeTime) return false;
  return ritualTime > wakeTime ? now >= ritualTime || now < wakeTime : now >= ritualTime && now < wakeTime;
}

export function resolveDark(input: { pref: ThemePref; forced: boolean; now: string; ritualTime: string; wakeTime: string }): boolean {
  if (input.forced) return true;
  if (input.pref === "dark") return true;
  if (input.pref === "light") return false;
  return isNightTime(input.now, input.ritualTime, input.wakeTime);
}

let appliedDark = false;

function setDark(dark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  storage.set(LAST_KEY, dark ? "dark" : "light");
  if (appliedDark !== dark) {
    appliedDark = dark;
    emit();
  }
}

/** Whether the dark variant is applied right now (for widgets with their own theme, e.g. the editor). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => appliedDark,
    () => false,
  );
}

/** First paint: reuse the last applied mode (settings aren't loaded yet). */
export function applyStoredTheme(): void {
  const pref = readThemePref();
  if (pref !== "auto") setDark(pref === "dark");
  else setDark(storage.get(LAST_KEY) === "dark");
}

// ---------- preference store ----------

const listeners = new Set<() => void>();
let forcedCount = 0;

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function readThemePref(): ThemePref {
  const v = storage.get(PREF_KEY);
  return v === "light" || v === "dark" ? v : "auto";
}

export function setThemePref(pref: ThemePref): void {
  if (pref === "auto") storage.remove(PREF_KEY);
  else storage.set(PREF_KEY, pref);
  emit();
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readThemePref, () => "auto");
}

function useForced(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => forcedCount > 0,
    () => false,
  );
}

/** Keep the dark variant on while the calling screen is mounted (night ritual). */
export function useForcedDark(): void {
  useEffect(() => {
    forcedCount++;
    emit();
    return () => {
      forcedCount--;
      emit();
    };
  }, []);
}

/** Mounted once in the Shell: applies the resolved mode and re-checks every minute. */
export function useThemeController(input: { ritualTime: string; wakeTime: string; now: Date }): boolean {
  const pref = useThemePref();
  const forced = useForced();
  const dark = resolveDark({ pref, forced, now: istTimeHHMM(input.now), ritualTime: input.ritualTime, wakeTime: input.wakeTime });
  useEffect(() => setDark(dark), [dark]);
  return dark;
}
