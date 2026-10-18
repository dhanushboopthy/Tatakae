import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { isNightTime, istTimeHHMM } from "@tatakae/core";
import { dark, f, light, type Palette } from "../theme";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, notifyLocalChange } from "../sync/engine";
import { useSettings } from "./hooks";

// Light "Soft Bento" by day, dark from ritual time to wake time (docs/10 §2). The per-phone choice
// (auto / light / dark) lives in the local meta table, not in synced settings. Quick close forces
// dark after ritual time while it is open (useForceDark).

export type ThemePref = "auto" | "light" | "dark";

const PREF_KEY = "theme_pref";

function makeText(c: Palette) {
  return StyleSheet.create({
    /** Huge number (score, timer). */
    hero: { ...f(600, 56, 62), color: c.ink, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
    /** Page title ("Thu, 22 Oct"). */
    title: { ...f(600, 30, 36), color: c.ink, letterSpacing: -0.6 },
    /** Card / P1 title. */
    cardTitle: { ...f(600, 20, 26), color: c.ink },
    /** Section heading inside a screen. */
    heading: { ...f(600, 18, 24), color: c.ink },
    body: { ...f(400, 16, 24), color: c.ink },
    bodyStrong: { ...f(600, 16, 22), color: c.ink },
    /** Secondary line under a title. */
    secondary: { ...f(500, 14, 20), color: c.ink2 },
    /** Chip / label. */
    label: { ...f(600, 13, 18), color: c.ink },
    /** Axis, time range, small print. */
    micro: { ...f(500, 12, 16), color: c.ink2 },
    /** Big number in a metric card. */
    big: { ...f(600, 34, 40), color: c.ink, letterSpacing: -0.7, fontVariant: ["tabular-nums"] },
  });
}

export type TextRoles = ReturnType<typeof makeText>;

export interface Theme {
  dark: boolean;
  c: Palette;
  t: TextRoles;
}

const LIGHT: Theme = { dark: false, c: light, t: makeText(light) };
const DARK: Theme = { dark: true, c: dark, t: makeText(dark) };

const ThemeContext = createContext<Theme>(LIGHT);

// ---------- forced dark (Quick close after ritual time) ----------

let forced = 0;
const forcedListeners = new Set<() => void>();
const subscribeForced = (l: () => void) => {
  forcedListeners.add(l);
  return () => forcedListeners.delete(l);
};
const getForced = () => forced > 0;

/** While `active`, the whole app uses the dark theme. */
export function useForceDark(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    forced++;
    forcedListeners.forEach((l) => l());
    return () => {
      forced--;
      forcedListeners.forEach((l) => l());
    };
  }, [active]);
}

// ---------- preference ----------

export function useThemePref() {
  return useQuery({
    queryKey: [LOCAL, ["meta:theme"], "theme"],
    queryFn: async (): Promise<ThemePref> => {
      const v = await store.getMeta(PREF_KEY);
      return v === "light" || v === "dark" ? v : "auto";
    },
  });
}

export async function setThemePref(pref: ThemePref): Promise<void> {
  if (pref === "auto") await store.deleteMeta(PREF_KEY);
  else await store.setMeta(PREF_KEY, pref);
  notifyLocalChange(["meta:theme"]);
}

/** "HH:MM" in IST, refreshed every minute and when the app comes back. */
function useClock(): string {
  const [now, setNow] = useState(() => istTimeHHMM());
  useEffect(() => {
    const tick = () => setNow(istTimeHHMM());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings().data;
  const pref = useThemePref().data ?? "auto";
  const isForced = useSyncExternalStore(subscribeForced, getForced, getForced);
  const now = useClock();
  const night = settings ? isNightTime(now, settings.ritual_time, settings.wake_time) : false;
  const isDark = isForced || pref === "dark" || (pref === "auto" && night);
  return <ThemeContext.Provider value={isDark ? DARK : LIGHT}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Styles built from the theme once per theme. `factory` must be defined at module level. */
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

/** Pressed feedback shared by every pressable (scale 0.98, no colour change). */
export const pressedStyle = { opacity: 0.85, transform: [{ scale: 0.98 }] } as const;
