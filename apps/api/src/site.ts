import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { Hono, type MiddlewareHandler } from "hono";
import { compress } from "hono/compress";
import type { Env } from "./env";

// Serving the website from the api process (Zoho Catalyst AppSail has no Caddy in front). Same
// routing, caching and security headers as deploy/Caddyfile, so moving hosts changes nothing for
// the browser: /api/* goes to the api, /assets/* are immutable, everything else revalidates and
// unknown paths fall back to index.html (SPA routes).

/** Content-Security-Policy for the website, identical to deploy/Caddyfile. */
export function websiteCsp(production: boolean): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Security headers on every response, API included. A route's own Content-Security-Policy wins
 * (uploaded files are served with `sandbox; default-src 'none'`).
 */
export function securityHeaders(env: Env): MiddlewareHandler {
  const production = env.NODE_ENV === "production";
  const csp = websiteCsp(production);
  return async (c, next) => {
    await next();
    const h = c.res.headers;
    if (production) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("X-Frame-Options", "DENY");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    if (!h.has("Content-Security-Policy")) h.set("Content-Security-Policy", csp);
  };
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Reads files under `root` once (the build doesn't change while the process runs); null if absent. */
function fileReader(root: string) {
  const base = resolve(root);
  const cache = new Map<string, { body: Uint8Array<ArrayBuffer>; type: string } | null>();
  return (urlPath: string) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    const path = resolve(base, `.${decoded}`);
    if (path !== base && !path.startsWith(base + sep)) return null; // never outside the build
    if (cache.has(path)) return cache.get(path) ?? null;
    let entry: { body: Uint8Array<ArrayBuffer>; type: string } | null = null;
    if (existsSync(path) && statSync(path).isFile()) {
      entry = { body: new Uint8Array(readFileSync(path)), type: TYPES[extname(path).toLowerCase()] ?? "application/octet-stream" };
    }
    cache.set(path, entry);
    return entry;
  };
}

/** The api plus the built website (WEB_DIST) behind one origin. */
export function withWebsite(api: { fetch: (req: Request) => Response | Promise<Response> }, env: Env, webDist: string): Hono {
  if (!existsSync(resolve(webDist, "index.html"))) throw new Error(`WEB_DIST has no index.html: ${webDist}`);
  const read = fileReader(webDist);
  const site = new Hono();
  site.use("*", securityHeaders(env));
  site.use("*", compress());

  site.all("/api/*", (c) => api.fetch(c.req.raw));
  site.all("/api", (c) => api.fetch(c.req.raw));

  // Hashed build output: cache forever. No SPA fallback, so a stale chunk name is a real 404.
  site.get("/assets/*", (c) => {
    const f = read(c.req.path);
    if (!f) return c.text("404 Not Found", 404, { "Cache-Control": "no-store" });
    return c.body(f.body, 200, { "Content-Type": f.type, "Cache-Control": "public, max-age=31536000, immutable" });
  });

  // index.html, sw.js, manifest, icons and SPA routes: revalidate every load so a deploy reaches clients.
  site.get("*", (c) => {
    const f = (c.req.path === "/" ? null : read(c.req.path)) ?? read("/index.html");
    if (!f) return c.text("404 Not Found", 404, { "Cache-Control": "no-store" });
    return c.body(f.body, 200, { "Content-Type": f.type, "Cache-Control": "no-cache" });
  });
  site.all("*", (c) => c.text("405 Method Not Allowed", 405, { "Cache-Control": "no-store" }));
  return site;
}
