import * as SecureStore from "expo-secure-store";
import { loginMobileResponse } from "@tatakae/core";
import { API_URL } from "../config";

// Phone session (shared design): POST /api/session/login { client: "mobile" } → { token, expiresAt }.
// The raw token lives only in SecureStore (Android Keystore) and is sent as `Authorization: Bearer`.
// expiresAt is informational: the server slides the expiry, so a stale local value never logs you
// out by itself — only a 401 does (see api/client.ts and sync/engine.ts).

const TOKEN_KEY = "tatakae.session";
const EXPIRES_KEY = "tatakae.session.expiresAt";

export type AuthState = "in" | "out";

let cachedToken: string | null | undefined;
const listeners = new Set<(s: AuthState) => void>();

function emit(state: AuthState): void {
  for (const l of listeners) l(state);
}

/** Called on login, logout and when a 401 clears the session. Returns unsubscribe. */
export function onAuthChange(listener: (s: AuthState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function getExpiresAt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EXPIRES_KEY);
  } catch {
    return null;
  }
}

export async function setExpiresAt(expiresAt: string): Promise<void> {
  await SecureStore.setItemAsync(EXPIRES_KEY, expiresAt);
}

/** Why a login did not go through; each maps to calm copy on the login screen. */
export type LoginProblem = "credentials" | "rate_limited" | "offline" | "server";

export class LoginError extends Error {
  readonly problem: LoginProblem;
  constructor(problem: LoginProblem) {
    super(problem);
    this.name = "LoginError";
    this.problem = problem;
  }
}

/** POST /api/session/login { email, password, client: "mobile", deviceName } → { token, expiresAt } */
export async function login(email: string, password: string, deviceName: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/session/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim(), password, client: "mobile", deviceName: deviceName.trim() || "phone" }),
    });
  } catch {
    throw new LoginError("offline");
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new LoginError("credentials");
  if (res.status === 429) throw new LoginError("rate_limited");
  if (!res.ok) throw new LoginError("server");

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new LoginError("server");
  }
  const parsed = loginMobileResponse.safeParse(body);
  if (!parsed.success) throw new LoginError("server");

  await SecureStore.setItemAsync(TOKEN_KEY, parsed.data.token);
  await SecureStore.setItemAsync(EXPIRES_KEY, parsed.data.expiresAt);
  cachedToken = parsed.data.token;
  emit("in");
}

/** Forget the token locally (after a 401 or a logout). Local rows and the outbox are kept. */
export async function clearSession(): Promise<void> {
  const had = cachedToken !== null;
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRES_KEY);
  } catch {
    // Nothing else to do; the in-memory token is already gone.
  }
  if (had) emit("out");
}

/** POST /api/session/logout (best effort, even offline), then delete the token. */
export async function logout(): Promise<void> {
  const token = await getToken();
  if (token) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      await fetch(`${API_URL}/api/session/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
    } catch {
      // Offline: the session expires on its own or can be revoked from a laptop.
    }
  }
  await clearSession();
}
