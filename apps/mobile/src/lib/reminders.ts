import { useQuery } from "@tanstack/react-query";
import { LOCAL } from "../sync/engine";
import { notificationsAllowed, shouldAskAboutTimes } from "../notifications/local";

// Query hooks for the reminder state shown in Settings and on Today (device-only, meta "notif").

export function useRemindersAllowed() {
  return useQuery({ queryKey: [LOCAL, ["meta:notif"], "allowed"], queryFn: notificationsAllowed });
}

/** True once two reminders in a row went unopened, until the question has been answered. */
export function useAskAboutTimes() {
  return useQuery({ queryKey: [LOCAL, ["meta:notif"], "ask-times"], queryFn: shouldAskAboutTimes });
}
