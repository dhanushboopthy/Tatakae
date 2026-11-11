import * as Notifications from "expo-notifications";
import { eraseLocalData } from "../db/client";
import { clearQuickActions } from "../native/quickActions";
import { updateP1Widget } from "../native/widget";
import { logout } from "./session";

/**
 * Sign out and leave nothing behind on this phone (security S11): the server session, the token,
 * every local row and the outbox (unsynced changes are lost, so Settings warns first), scheduled
 * reminders, launcher shortcuts, and the widget goes back to its empty state.
 */
export async function logoutAndErase(): Promise<void> {
  await logout();
  eraseLocalData(); // the caller clears the query cache
  await Promise.allSettled([Notifications.cancelAllScheduledNotificationsAsync(), clearQuickActions(), updateP1Widget()]);
}
