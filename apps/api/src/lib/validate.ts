import type { Context } from "hono";
import type { z } from "zod";
import { isIsoDate, type ISODate } from "@tatakae/core";
import { BadRequest } from "./errors";

/** Parse the JSON body with a zod schema. Bad JSON → 400; ZodError → 400 via middleware/errors. */
export async function parseBody<S extends z.ZodTypeAny>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new BadRequest("Body must be JSON.", "invalid_json");
  }
  return schema.parse(raw);
}

/** Parse query parameters (strings) with a zod schema. */
export function parseQuery<S extends z.ZodTypeAny>(c: Context, schema: S): z.output<S> {
  return schema.parse(c.req.query());
}

/** A real calendar date `YYYY-MM-DD` from a route param. */
export function dateParam(c: Context, name = "date"): ISODate {
  const value = c.req.param(name) ?? "";
  if (!isIsoDate(value)) throw new BadRequest("Expected a date like 2026-10-19.", "invalid_date");
  return value;
}

/** Non-empty string route param. */
export function idParam(c: Context, name = "id"): string {
  const value = c.req.param(name);
  if (!value) throw new BadRequest(`Missing ${name}.`);
  return value;
}
