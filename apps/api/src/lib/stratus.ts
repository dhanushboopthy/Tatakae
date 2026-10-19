import type { Env } from "../env";

// Zoho Catalyst Stratus over plain REST (C4): uploaded files and nightly backups when the host's disk
// isn't durable (AppSail). No SDK: the Node SDK needs a live request for credentials, which the
// nightly job doesn't have. A Zoho self-client refresh token (scopes Stratus.fileop.CREATE and
// Stratus.fileop.READ) is exchanged for a 1-hour access token, cached until shortly before expiry.
//   PUT {bucket}/{key}   upload (overwrite: true, optional expires-after TTL)
//   GET {bucket}/{key}   download (404 → null)

export function stratusConfigured(env: Env): boolean {
  return Boolean(env.STRATUS_BUCKET_URL && env.ZOHO_ACCOUNTS_URL && env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_REFRESH_TOKEN);
}

export class StratusError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StratusError";
    this.status = status;
  }
}

let token: { value: string; until: number; for: string } | null = null;

/** For tests: forget the cached access token. */
export function resetStratusToken(): void {
  token = null;
}

async function accessToken(env: Env, now: () => number = Date.now): Promise<string> {
  const owner = `${env.ZOHO_ACCOUNTS_URL}|${env.ZOHO_CLIENT_ID}`;
  if (token && token.for === owner && now() < token.until) return token.value;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: env.ZOHO_REFRESH_TOKEN ?? "",
    client_id: env.ZOHO_CLIENT_ID ?? "",
    client_secret: env.ZOHO_CLIENT_SECRET ?? "",
  });
  const res = await fetch(`${(env.ZOHO_ACCOUNTS_URL ?? "").replace(/\/$/, "")}/oauth/v2/token`, { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown; error?: unknown };
  if (!res.ok || typeof data.access_token !== "string") {
    // Never log the response body: on some errors it echoes the request.
    throw new StratusError(res.status, `Zoho token refresh failed (${res.status}${typeof data.error === "string" ? `: ${data.error}` : ""})`);
  }
  const ttlSec = typeof data.expires_in === "number" ? data.expires_in : 3600;
  token = { value: data.access_token, until: now() + Math.max(60, ttlSec - 120) * 1000, for: owner };
  return token.value;
}

function objectUrl(env: Env, key: string): string {
  const base = (env.STRATUS_BUCKET_URL ?? "").replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Upload (replacing any object with the same key). `expiresAfterSec` lets Stratus delete it later. */
export async function stratusPut(
  env: Env,
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
  opts: { expiresAfterSec?: number } = {},
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${await accessToken(env)}`,
    "content-type": contentType,
    overwrite: "true",
  };
  if (opts.expiresAfterSec) headers["expires-after"] = String(Math.max(60, Math.round(opts.expiresAfterSec)));
  const res = await fetch(objectUrl(env, key), { method: "PUT", headers, body });
  if (res.status === 401) resetStratusToken(); // revoked or expired early: refresh next time
  if (!res.ok) throw new StratusError(res.status, `Stratus upload of ${key} failed (${res.status})`);
}

/** Download, or null when the object doesn't exist. */
export async function stratusGet(env: Env, key: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const res = await fetch(objectUrl(env, key), { headers: { Authorization: `Zoho-oauthtoken ${await accessToken(env)}` } });
  if (res.status === 404) return null;
  if (res.status === 401) resetStratusToken();
  if (!res.ok) throw new StratusError(res.status, `Stratus download of ${key} failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}
