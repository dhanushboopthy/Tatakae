import { api, isNetworkError, statusOf } from "./api";
import { storage } from "./storage";

// Session state for the auth gate (Shell) and Login. The server keeps an HttpOnly cookie; the client
// only caches "who was logged in last" so the app can open offline.

const ME_KEY = "tatakae.me";
const DEVICE_KEY = "tatakae.deviceName";
export const DEFAULT_DEVICE_NAME = "laptop-1";

/** GET /api/session/me — read leniently so extra/missing fields from the API don't break the gate. */
function parseMe(body: unknown): { deviceName?: string; email?: string } {
  if (typeof body !== "object" || body === null) return {};
  const rec = body as Record<string, unknown>;
  // Accept either a flat body or `{ session: {...} }`.
  const src = typeof rec["session"] === "object" && rec["session"] !== null ? (rec["session"] as Record<string, unknown>) : rec;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
  return { deviceName: str(src["deviceName"]), email: str(rec["email"]) ?? str(src["email"]) };
}

export interface CachedMe {
  deviceName: string | null;
  email: string | null;
  /** When the server last confirmed the session (ISO). */
  checkedAt: string;
}

export function readCachedMe(): CachedMe | null {
  const raw = storage.get(ME_KEY);
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === "object" && v !== null && "checkedAt" in v) return v as CachedMe;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedMe(me: CachedMe | null): void {
  if (me) storage.set(ME_KEY, JSON.stringify(me));
  else storage.remove(ME_KEY);
}

export function rememberedDeviceName(): string {
  return storage.get(DEVICE_KEY) ?? DEFAULT_DEVICE_NAME;
}

export type SessionCheck =
  | { state: "ok"; me: CachedMe }
  | { state: "offline"; me: CachedMe } // network down, previously logged in → allow offline use
  | { state: "signed-out" };

/** Confirms the session with the server; falls back to the cached session when offline. */
export async function checkSession(): Promise<SessionCheck> {
  try {
    const body = parseMe(await api("/session/me", { skipAuthRedirect: true }));
    const me: CachedMe = {
      deviceName: body.deviceName ?? readCachedMe()?.deviceName ?? null,
      email: body.email ?? null,
      checkedAt: new Date().toISOString(),
    };
    writeCachedMe(me);
    return { state: "ok", me };
  } catch (e) {
    const status = statusOf(e);
    if (status === 401 || status === 403) {
      writeCachedMe(null);
      return { state: "signed-out" };
    }
    // Offline, 5xx or another error: keep working from the local store if we were logged in.
    const cached = readCachedMe();
    return cached ? { state: "offline", me: cached } : { state: "signed-out" };
  }
}

// ---------- login / logout ----------

type Listener = (event: "login" | "logout") => void;
const listeners = new Set<Listener>();

/** The sync engine listens for "login" to resume flushing after a 401. */
export function onSessionEvent(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export type LoginResult = { ok: true } | { ok: false; reason: "credentials" | "rate-limited" | "offline" | "server" };

export async function login(input: { email: string; password: string; deviceName: string }): Promise<LoginResult> {
  const deviceName = input.deviceName.trim() || DEFAULT_DEVICE_NAME;
  storage.set(DEVICE_KEY, deviceName);
  try {
    await api("/session/login", {
      method: "POST",
      body: { email: input.email.trim(), password: input.password, client: "web", deviceName },
      skipAuthRedirect: true,
    });
  } catch (e) {
    const status = statusOf(e);
    if (status === 401 || status === 400 || status === 403) return { ok: false, reason: "credentials" };
    if (status === 429) return { ok: false, reason: "rate-limited" };
    if (isNetworkError(e)) return { ok: false, reason: "offline" };
    return { ok: false, reason: "server" };
  }
  writeCachedMe({ deviceName, email: input.email.trim(), checkedAt: new Date().toISOString() });
  for (const l of listeners) l("login");
  return { ok: true };
}

/** Logs out on the server (best effort) and forgets the cached session. Local data and outbox stay. */
export async function logout(): Promise<void> {
  try {
    await api("/session/logout", { method: "POST", skipAuthRedirect: true });
  } catch {
    /* offline: the cookie expires on its own; we still forget the session locally */
  }
  writeCachedMe(null);
  for (const l of listeners) l("logout");
}

/** Called on any 401: the session is gone, so offline access must stop too. */
export function forgetSession(): void {
  writeCachedMe(null);
}
