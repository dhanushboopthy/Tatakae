/**
 * TODO(v2, Android only): read today's minutes for user-chosen recreational apps via UsageStatsManager
 * (custom Expo module; user grants "Usage access" in system settings). Prefills days.screen_min.
 * Manual entry remains the fallback. Guard every call with Platform.OS === "android".
 */
export interface UsageStatsModule {
  hasPermission(): Promise<boolean>;
  openPermissionSettings(): Promise<void>;
  minutesToday(packageNames: string[]): Promise<number>;
}
