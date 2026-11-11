import type { Context, MiddlewareHandler } from "hono";

/** Client IP: first hop of X-Forwarded-For (set by Caddy), then X-Real-IP, else "unknown". */
export function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return c.req.header("x-real-ip")?.trim() || "unknown";
}

/**
 * In-memory fixed-window limiter keyed by client IP. Enough for one user on one process.
 * Over the limit → 429 with Retry-After (seconds). `methods` limits which methods count.
 */
export function rateLimit(opts: {
  windowSec: number;
  max: number;
  methods?: readonly string[];
  now?: () => number;
}): MiddlewareHandler {
  const windowMs = opts.windowSec * 1000;
  const now = opts.now ?? Date.now;
  const methods = opts.methods?.map((m) => m.toUpperCase());
  const hits = new Map<string, { start: number; count: number }>();

  return async (c, next) => {
    if (methods && !methods.includes(c.req.method.toUpperCase())) return next();
    const t = now();
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
    }
    const ip = clientIp(c);
    let entry = hits.get(ip);
    if (!entry || t - entry.start >= windowMs) {
      entry = { start: t, count: 0 };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > opts.max) return tooMany(c, entry.start + windowMs - t);
    return next();
  };
}

function tooMany(c: Context, msLeft: number): Response {
  const retryAfter = Math.max(1, Math.ceil(msLeft / 1000));
  c.header("Retry-After", String(retryAfter));
  return c.json({ error: "rate_limited", message: "Too many attempts. Try again later.", detail: { retryAfter } }, 429);
}

/**
 * Global cap on *failed* attempts (401 from login, 403 from the step-up re-auth), across every IP. The per-IP limiter
 * alone lets someone with many addresses keep guessing; this stops all password guessing for the
 * rest of the window once `max` failures pile up. Successful logins don't count, and the passkey
 * sign-in and existing sessions keep working while it is closed. Share one instance between routes
 * that check the same password.
 */
export function failureLimit(opts: { windowSec: number; max: number; now?: () => number }): MiddlewareHandler {
  const windowMs = opts.windowSec * 1000;
  const now = opts.now ?? Date.now;
  let window = { start: 0, failures: 0 };

  return async (c, next) => {
    if (c.req.method.toUpperCase() !== "POST") return next();
    const t = now();
    if (t - window.start >= windowMs) window = { start: t, failures: 0 };
    if (window.failures >= opts.max) return tooMany(c, window.start + windowMs - t);
    await next();
    if (c.res.status === 401 || c.res.status === 403) {
      if (window.failures === 0) window.start = t; // the window starts at the first failure
      window.failures += 1;
    }
  };
}
