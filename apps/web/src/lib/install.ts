import { useSyncExternalStore } from "react";
import { storage } from "./storage";

// Desktop install prompt (Chrome/Edge). `beforeinstallprompt` fires early, so it is captured at module
// load (imported from main.tsx) and replayed when the user presses "Install app" after login.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "tatakae.installDismissed";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  return "prompt" in e && typeof (e as { prompt?: unknown }).prompt === "function";
}

export function captureInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    if (isPromptEvent(e)) {
      deferred = e;
      emit();
    }
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function snapshot(): boolean {
  return deferred !== null && !installed && storage.get(DISMISSED_KEY) !== "1";
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** `available` is true while the browser offers installation and the user hasn't dismissed it. */
export function useInstallPrompt(): { available: boolean; install: () => Promise<void>; dismiss: () => void } {
  const available = useSyncExternalStore(subscribe, snapshot, () => false);
  return {
    available,
    async install() {
      const ev = deferred;
      if (!ev) return;
      deferred = null;
      await ev.prompt();
      await ev.userChoice.catch(() => undefined);
      emit();
    },
    dismiss() {
      storage.set(DISMISSED_KEY, "1");
      emit();
    },
  };
}
