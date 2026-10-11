/** Feature detection; degrade silently where unsupported. */
export const platform = {
  isStandalone: () => typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches,
  hasWakeLock: () => typeof navigator !== "undefined" && "wakeLock" in navigator,
  hasBadging: () => typeof navigator !== "undefined" && "setAppBadge" in navigator,
  hasBackgroundSync: () =>
    typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "SyncManager" in window,
  hasPush: () => typeof window !== "undefined" && "PushManager" in window,
  isMac: () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
};

/** navigator.storage.persist() — asked once on first run (see sync/engine.ts). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Screen Wake Lock (focus timer). Returns a release function; no-op where unsupported. */
export async function requestWakeLock(): Promise<() => void> {
  if (!platform.hasWakeLock()) return () => undefined;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    return () => void sentinel.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
