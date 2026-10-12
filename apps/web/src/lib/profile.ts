import { useSyncExternalStore } from "react";
import { storage } from "./storage";

// Per-device display name for the greeting ("Good evening, <name>"). Single-user app: kept local,
// never synced or sent anywhere.

const KEY = "tatakae.displayName";
const listeners = new Set<() => void>();

export function readDisplayName(): string {
  return storage.get(KEY) ?? "";
}

export function setDisplayName(name: string): void {
  const v = name.trim().slice(0, 40);
  if (v) storage.set(KEY, v);
  else storage.remove(KEY);
  for (const l of listeners) l();
}

export function useDisplayName(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readDisplayName,
    () => "",
  );
}

/** "Good morning" before 12:00 IST, "Good afternoon" before 17:00, then "Good evening". */
export function greeting(hhmm: string, name: string): string {
  const part = hhmm < "12:00" && hhmm >= "04:00" ? "Good morning" : hhmm < "17:00" && hhmm >= "12:00" ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}
