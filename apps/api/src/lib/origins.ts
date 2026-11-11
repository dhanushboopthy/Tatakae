import type { Env } from "../env";

/** Origins the website is served from: PUBLIC_ORIGIN plus any WEBAUTHN_ORIGINS (e.g. a second dev port). */
export function allowedOrigins(env: Env): string[] {
  const list = [env.PUBLIC_ORIGIN, ...(env.WEBAUTHN_ORIGINS ?? "").split(",")];
  return [...new Set(list.map((o) => o.trim().replace(/\/$/, "")).filter(Boolean))];
}

/**
 * True when a browser says this request came from another site. Browsers send `Origin` on every
 * cross-origin write; without it, `Sec-Fetch-Site` decides. A request with neither (curl, the phone
 * app) is not a browser being tricked into sending our cookie, so it passes.
 */
export function isCrossSite(env: Env, headers: { origin?: string; secFetchSite?: string }): boolean {
  if (headers.origin !== undefined) return !allowedOrigins(env).includes(headers.origin.replace(/\/$/, ""));
  return headers.secFetchSite === "cross-site" || headers.secFetchSite === "same-site";
}
