/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Background Sync (Chromium): the page registers tag "outbox" after each write. When connectivity
// returns, tell open tabs to flush — the sync engine (and the session cookie) live in the page.
// With no tab open nothing is sent; the next app open flushes anyway.
interface SyncEventLike extends ExtendableEvent {
  tag: string;
}

self.addEventListener("sync", (event: Event) => {
  const e = event as SyncEventLike;
  if (e.tag !== "outbox") return;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) c.postMessage({ type: "flush-outbox" });
    }),
  );
});

// TODO(v4): 'push' event → showNotification; 'notificationclick' → focus /ritual
