import { api, ApiError } from "./api";
import { platform } from "./platform";

// Laptop web push opt-in (v4, optional). One message a day at 06:30 (today's P1). The permission
// prompt only appears after the owner presses "Turn on" — never on load.

export type PushState = "unsupported" | "server-off" | "blocked" | "off" | "on";

/** VAPID public key (base64url) → the BufferSource PushManager.subscribe expects. */
export function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!platform.hasPush() || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function serverKey(): Promise<string | null> {
  try {
    const body = (await api("/push/key")) as { publicKey?: unknown };
    return typeof body.publicKey === "string" ? body.publicKey : null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return null;
    throw e;
  }
}

export async function readPushState(): Promise<PushState> {
  const reg = await registration();
  if (!reg || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if ((await serverKey()) === null) return "server-off";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(device: string | null): Promise<PushState> {
  const reg = await registration();
  if (!reg) return "unsupported";
  const key = await serverKey();
  if (key === null) return "server-off";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }));
  const json = sub.toJSON();
  await api("/push/subscribe", { method: "POST", body: { endpoint: json.endpoint, keys: json.keys, device } });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}

export async function sendTestPush(): Promise<boolean> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return false;
  const body = (await api("/push/test", { method: "POST", body: { endpoint: sub.endpoint } })) as { sent?: unknown };
  return body.sent === 1;
}
