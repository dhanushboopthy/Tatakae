import type { MiddlewareHandler } from "hono";

/** In-memory fixed-window limiter keyed by client IP (X-Forwarded-For from Caddy). Enough for one user. */
export function rateLimit(opts: { windowSec: number; max: number }): MiddlewareHandler {
  return async (_c, next) => {
    // TODO(phase0)
    await next();
  };
}
