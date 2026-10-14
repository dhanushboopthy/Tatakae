/**
 * Thin fetch wrapper for /api (REST only: session, devices, notes). Data reads come from the local
 * IndexedDB store and writes go through the sync outbox (src/sync), so the app works offline.
 *
 * On 401 (outside the login call) the registered handler sends the user to /login. The outbox and
 * local rows are never cleared, so nothing written offline is lost.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Network failure (offline, DNS, CORS…): no HTTP status. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "network error");
    this.name = "NetworkError";
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Registered once in main.tsx (navigates to /login, keeping the outbox). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** Called by the api wrapper and by the sync engine on HTTP 401. */
export function notifyUnauthorized(): void {
  onUnauthorized?.();
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the global 401 redirect (the login form handles its own 401). */
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
  /** Let the request outlive the page (pagehide saves); the body must stay under 64 KB. */
  keepalive?: boolean;
}

async function readBody(res: Response): Promise<unknown> {
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 204) return null;
  try {
    return type.includes("application/json") ? await res.json() : await res.text();
  } catch {
    return null;
  }
}

/** fetch `/api${path}` with cookies; returns the decoded body (unknown — validate at the call site). */
export async function api(path: string, opts: ApiOptions = {}): Promise<unknown> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    keepalive: opts.keepalive,
  };
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (e) {
    throw new NetworkError(e);
  }
  const body = await readBody(res);
  if (res.status === 401 && !opts.skipAuthRedirect) notifyUnauthorized();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** POST multipart/form-data (file uploads); the browser sets the boundary header. */
export async function apiUpload(path: string, form: FormData): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: form });
  } catch (e) {
    throw new NetworkError(e);
  }
  const body = await readBody(res);
  if (res.status === 401) notifyUnauthorized();
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** GET helper kept for older call sites. */
export async function apiGet(path: string): Promise<unknown> {
  return api(path);
}

export const isNetworkError = (e: unknown): e is NetworkError => e instanceof NetworkError;
export const statusOf = (e: unknown): number | null => (e instanceof ApiError ? e.status : null);
