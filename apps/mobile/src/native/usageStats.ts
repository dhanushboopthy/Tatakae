import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { useQuery } from "@tanstack/react-query";
import { addDays, type ISODate } from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, notifyLocalChange } from "../sync/engine";
import { dayWindow, foregroundMinutes, parseChosenApps, type UsageEvent } from "./usageMinutes";

// Screen minutes from Android's usage data (v2.5, local module modules/usage-stats). The user grants
// "Usage access" in system settings and picks which apps count; Quick close then fills in today's
// minutes. Only the daily total is saved (days.screen_min, through the outbox); the app list stays on
// this phone. Typing the number stays the fallback everywhere.

export interface RecentApp {
  packageName: string;
  label: string;
  /** Android's own total for the period; used only to rank the list. */
  minutes: number;
}

interface NativeUsageStats {
  hasPermission(): boolean;
  openPermissionSettings(): void;
  events(startMs: number, endMs: number, packages: string[]): Promise<UsageEvent[]>;
  recentApps(startMs: number, endMs: number): Promise<RecentApp[]>;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<NativeUsageStats>("TatakaeUsageStats") : null;

/** False in Expo Go, on iOS and in tests: the screen-minutes field is typed by hand. */
export const usageStatsAvailable = native != null;

const APPS_KEY = "usage_apps";
const TABLE = "meta:usage";

function allowedNow(): boolean {
  try {
    return native?.hasPermission() ?? false;
  } catch {
    return false;
  }
}

export function openUsageAccessSettings(): void {
  try {
    native?.openPermissionSettings();
  } catch {
    // No settings screen on this phone; the number stays typed by hand.
  }
}

/** Usage access, checked again whenever the app comes back (e.g. from system settings). */
export function useUsageAccess(): boolean {
  const [allowed, setAllowed] = useState(allowedNow);
  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAllowed(allowedNow());
    });
    return () => sub.remove();
  }, []);
  return allowed;
}

export function useChosenApps() {
  return useQuery({
    queryKey: [LOCAL, [TABLE], "apps"],
    queryFn: async () => parseChosenApps(await store.getMeta(APPS_KEY)),
  });
}

export async function setChosenApps(packages: readonly string[]): Promise<void> {
  if (packages.length === 0) await store.deleteMeta(APPS_KEY);
  else await store.setMeta(APPS_KEY, JSON.stringify([...new Set(packages)]));
  notifyLocalChange([TABLE]);
}

/** Apps used in the last 7 days, most used first, to choose from. */
export function useRecentApps(today: ISODate, allowed: boolean) {
  return useQuery({
    queryKey: [LOCAL, [TABLE], "recent", today, allowed],
    enabled: allowed && native != null,
    queryFn: async (): Promise<RecentApp[]> => {
      const { start } = dayWindow(addDays(today, -6), Date.now());
      return (await native?.recentApps(start, Date.now())) ?? [];
    },
  });
}

/**
 * Minutes the chosen apps were open on `date` (04:00 IST to now), or null when it can't be read:
 * no module, no usage access, or no apps chosen. Read fresh each time it is shown.
 */
export function useUsageMinutes(date: ISODate, allowed: boolean) {
  const apps = useChosenApps().data ?? [];
  return useQuery({
    queryKey: [LOCAL, [TABLE], "minutes", date, allowed, apps],
    enabled: allowed && native != null && apps.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<number | null> => {
      if (!native) return null;
      const { start, end } = dayWindow(date, Date.now());
      return foregroundMinutes(await native.events(start, end, apps), start, end);
    },
  });
}
