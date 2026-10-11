/** Feature detection; degrade silently on iOS. */
export const platform = {
  isStandalone: () => matchMedia("(display-mode: standalone)").matches,
  hasWakeLock: () => "wakeLock" in navigator,
  hasBadging: () => "setAppBadge" in navigator,
  hasBackgroundSync: () => "serviceWorker" in navigator && "SyncManager" in window,
  hasPush: () => "PushManager" in window,
};

export async function requestPersistentStorage(): Promise<boolean> {
  // TODO(v1): navigator.storage.persist() on first run
  return false;
}
