import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_FILE_BYTES } from "../routes/files";

// Request body caps, checked while the body streams in (Content-Length is not trusted). Caddy caps
// /api at 25 MB in front of this. One middleware picks the cap by path, because stacked limits would
// let the smallest win everywhere.

const KB = 1024;
const MB = 1024 * KB;

export const BODY_LIMITS = {
  /** Public sign-in endpoints: a few hundred bytes in practice. */
  signIn: 64 * KB,
  /** Uploads: the file plus multipart overhead. */
  files: MAX_FILE_BYTES + 64 * KB,
  /** Batched sync pushes (≤ 500 items) and story pack imports. */
  bulk: 10 * MB,
  /** Everything else: notes, settings, single rows. */
  default: 2 * MB,
} as const;

export function bodyLimitFor(path: string): number {
  if (path.startsWith("/api/session/") || path.startsWith("/api/passkeys/login") || path.startsWith("/api/passkeys/reauth")) {
    return BODY_LIMITS.signIn;
  }
  if (path === "/api/files" || path.startsWith("/api/files/")) return BODY_LIMITS.files;
  if (path === "/api/sync" || path === "/api/story/import") return BODY_LIMITS.bulk;
  return BODY_LIMITS.default;
}

export const bodyLimits: MiddlewareHandler = (c, next) =>
  bodyLimit({
    maxSize: bodyLimitFor(c.req.path),
    onError: (ctx) => ctx.json({ error: "too_large", message: "That request is too big." }, 413),
  })(c, next);
