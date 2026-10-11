import type { ErrorHandler } from "hono";

/** Map ZodError → 400, NotFound → 404, LockedError → 423, else 500. JSON { error, detail }. */
export const errors: ErrorHandler = (err, c) => {
  // TODO(v1)
  return c.json({ error: "internal", detail: String(err) }, 500);
};
