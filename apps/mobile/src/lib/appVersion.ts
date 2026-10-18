// "Update available" (v4.3), pure so it is tested without React Native. The server says the oldest
// app version it expects (GET /api/app/version → minMobileVersion); an older app gets a calm banner
// with the APK link. It never blocks: everything keeps working on the old version.

export interface AppVersionInfo {
  minMobileVersion: string;
  latestApkUrl: string | null;
}

/** Where the banner points when the server has no direct APK link. */
export const RELEASES_URL = "https://github.com/dhanushboopthy/Tatakae/releases/latest";

/** [major, minor, patch] from "1.2.3" (a "v" prefix and any "-tag" are ignored), or null. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `a` is strictly older than `b`. Unreadable versions are never "older". */
export function isOlder(a: string, b: string): boolean {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) {
    if (x[i]! !== y[i]!) return x[i]! < y[i]!;
  }
  return false;
}

/**
 * The banner to show, or null: only when this app is older than the server's minimum and the owner
 * hasn't already said "Later" to that same minimum.
 */
export function updateNotice(
  current: string | null | undefined,
  info: AppVersionInfo | null | undefined,
  dismissedFor: string | null,
): { version: string; url: string } | null {
  if (!current || !info || !isOlder(current, info.minMobileVersion)) return null;
  if (dismissedFor === info.minMobileVersion) return null;
  return { version: info.minMobileVersion, url: info.latestApkUrl ?? RELEASES_URL };
}
