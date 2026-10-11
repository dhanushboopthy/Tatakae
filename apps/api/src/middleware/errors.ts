import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodIssue } from "zod";
import type { AppBindings } from "../env";
import { HttpError } from "../lib/errors";

/** ZodError check that survives two copies of zod (core's and the api's). */
function zodIssues(err: unknown): ZodIssue[] | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { name?: unknown; issues?: unknown };
  return e.name === "ZodError" && Array.isArray(e.issues) ? (e.issues as ZodIssue[]) : null;
}

/**
 * JSON errors: `{ error, message, detail? }`.
 * ZodError → 400 (`detail` = issues), HttpError → its status, HTTPException → its response,
 * anything else → 500 (logged, no internals leaked).
 */
export const errors: ErrorHandler<AppBindings> = (err, c) => {
  const issues = zodIssues(err);
  if (issues) return c.json({ error: "invalid_input", message: "Some fields are not valid.", detail: issues }, 400);
  if (err instanceof HttpError) {
    const body: { error: string; message: string; detail?: unknown } = { error: err.code, message: err.message };
    if (err.detail !== undefined) body.detail = err.detail;
    return c.json(body, err.status);
  }
  if (err instanceof HTTPException) return err.getResponse();
  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, err);
  return c.json({ error: "internal", message: "Something went wrong on the server." }, 500);
};
