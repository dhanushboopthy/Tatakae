import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, notifyLocalChange } from "../sync/engine";
import { updateNotice, type AppVersionInfo } from "./appVersion";

// "Update available" (v4.3). A new APK: calm banner with the release link (Today and Settings).
// JS-only fixes come through EAS Update by themselves (expo-updates checks on launch, downloads, and
// applies on the next launch; app.config.ts), so they need no banner.

const DISMISS_KEY = "update_dismissed";
const TABLE = "meta:update";

export const APP_VERSION: string | null = Constants.expoConfig?.version ?? null;

/** GET /api/app/version, at most every 6 hours; null when offline or the server can't say. */
function useServerVersion() {
  return useQuery({
    queryKey: ["app", "version"],
    queryFn: async (): Promise<AppVersionInfo | null> => {
      try {
        return await apiGet<AppVersionInfo>("/app/version");
      } catch {
        return null;
      }
    },
    staleTime: 6 * 60 * 60_000,
  });
}

function useDismissedFor() {
  return useQuery({
    queryKey: [LOCAL, [TABLE]],
    queryFn: () => store.getMeta(DISMISS_KEY),
  });
}

/** The banner to show now, or null. `ignoreDismiss` keeps it in Settings after "Later". */
export function useUpdateNotice(opts: { ignoreDismiss?: boolean } = {}) {
  const server = useServerVersion();
  const dismissed = useDismissedFor();
  if (dismissed.isPending) return null;
  return updateNotice(APP_VERSION, server.data, opts.ignoreDismiss ? null : (dismissed.data ?? null));
}

/** "Later": hide the Today banner until the server asks for a newer version. */
export async function dismissUpdate(version: string): Promise<void> {
  await store.setMeta(DISMISS_KEY, version);
  notifyLocalChange([TABLE]);
}
