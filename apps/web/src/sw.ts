/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// TODO(v1): 'sync' event (tag "outbox") → flush outbox (Android only)
// TODO(v4): 'push' event → showNotification; 'notificationclick' → focus /morning or /ritual
