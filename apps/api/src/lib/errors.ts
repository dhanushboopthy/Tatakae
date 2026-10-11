import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Errors thrown by services/routes and turned into JSON by middleware/errors.ts:
 * `{ error: code, message, detail? }` with the matching status.
 */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly detail: unknown;

  constructor(status: ContentfulStatusCode, code: string, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class BadRequest extends HttpError {
  constructor(message = "Invalid request.", code = "bad_request", detail?: unknown) {
    super(400, code, message, detail);
  }
}

export class Unauthorized extends HttpError {
  constructor(message = "Sign in again.", code = "unauthorized") {
    super(401, code, message);
  }
}

export class NotFound extends HttpError {
  constructor(message = "Not found.", code = "not_found") {
    super(404, code, message);
  }
}

export class Conflict extends HttpError {
  constructor(message = "Conflict.", code = "conflict", detail?: unknown) {
    super(409, code, message, detail);
  }
}

/** Plan lock / even-Sunday guard. */
export class Locked extends HttpError {
  constructor(message = "This is locked.", code = "locked", detail?: unknown) {
    super(423, code, message, detail);
  }
}
