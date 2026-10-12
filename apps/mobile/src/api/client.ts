import { router } from "expo-router";
import { API_URL } from "../config";
import { clearSession, getToken } from "../auth/session";

// REST helper for the few calls that are not synced (session/me, devices). Everything the screens
// show comes from the local store; this is never on the critical path of a write.

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server (offline, timeout). */
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown = null) {
    super(status === 0 ? "offline" : `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Session expired or revoked: forget the token and go to Login. Local data stays. */
export async function handleUnauthorized(): Promise<void> {
  await clearSession();
  try {
    router.replace("/login");
  } catch {
    // Navigator not mounted yet (e.g. background task); the auth gate redirects on next render.
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function apiFetch<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0);
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  const textBody = await res.text();
  if (textBody) {
    try {
      data = JSON.parse(textBody);
    } catch {
      data = textBody;
    }
  }

  if (res.status === 401) {
    await handleUnauthorized();
    throw new ApiError(401, data);
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiFetch<T>(path, "GET");
export const apiPost = <T>(path: string, body?: unknown): Promise<T> => apiFetch<T>(path, "POST", body ?? {});
export const apiDelete = <T>(path: string): Promise<T> => apiFetch<T>(path, "DELETE");
