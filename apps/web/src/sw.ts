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

// Web push (v4, optional, laptops only): the server sends { title, body, url, tag } at 06:30.
interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function parsePush(data: PushMessageData | null): PushPayload {
  const fallback: PushPayload = { title: "Tatakae", body: "Your plan is ready.", url: "/today", tag: "tatakae" };
  if (!data) return fallback;
  try {
    const v = data.json() as Partial<PushPayload>;
    return {
      title: typeof v.title === "string" ? v.title : fallback.title,
      body: typeof v.body === "string" ? v.body : fallback.body,
      url: typeof v.url === "string" && v.url.startsWith("/") ? v.url : fallback.url,
      tag: typeof v.tag === "string" ? v.tag : fallback.tag,
    };
  } catch {
    return { ...fallback, body: data.text() || fallback.body };
  }
}

self.addEventListener("push", (event: PushEvent) => {
  const p = parsePush(event.data);
  event.waitUntil(
    self.registration.showNotification(p.title, { body: p.body, tag: p.tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: p.url } }),
  );
});

// Click → focus an open tab on that screen, else open one.
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const url = typeof data?.url === "string" ? data.url : "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await (c as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    }),
  );
});
