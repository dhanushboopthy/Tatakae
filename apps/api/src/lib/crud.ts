import { Hono } from "hono";
import { z } from "zod";
import type { SyncRowMap, SyncTable } from "@tatakae/core";
import type { AppBindings } from "../env";
import type { Db } from "./db";
import { Conflict, NotFound } from "./errors";
import { newId } from "./ids";
import { allLocal, getLocal, putLocal, type LocalRow, type LocalTable } from "./local.service";
import { allRows, bumpUpdatedAt, getRow, softDeleteRow, upsertRow, withoutUndefined } from "./rows.service";
import { idParam, parseBody } from "./validate";

// REST CRUD for an id-keyed synced table (v2 resources). Every write goes through upsertRow, so the
// row is validated with core rowSchemas and recorded in the change log for sync.
//   GET    /       → { items }  (live rows; `sort` orders them)
//   GET    /:id    → { item }
//   POST   /       input (+ id?) → 201 { item }
//   PATCH  /:id    patch → { item }
//   DELETE /:id    → { item }  (soft delete)

type IdTable = { [T in SyncTable]: SyncRowMap[T] extends { id: string } ? T : never }[SyncTable];

export interface CrudOptions<T extends IdTable, I extends z.ZodTypeAny, P extends z.ZodTypeAny> {
  table: T;
  input: I;
  patch: P;
  label: string;
  sort?: (a: SyncRowMap[T], b: SyncRowMap[T]) => number;
  /** Defaults for row fields the input doesn't carry. */
  defaults?: () => Partial<SyncRowMap[T]>;
  /** Business rules on the would-be row; throw an HttpError to refuse. */
  guard?: (db: Db, next: SyncRowMap[T], prev: SyncRowMap[T] | null) => void;
}

export function requireLive<T extends IdTable>(db: Db, table: T, id: string, label: string): SyncRowMap[T] {
  const row = getRow(db, table, id);
  if (!row || row.deletedAt != null) throw new NotFound(`No such ${label}.`);
  return row;
}

export function liveRows<T extends SyncTable>(db: Db, table: T): SyncRowMap[T][] {
  return allRows(db, table, { includeDeleted: false });
}

export function crudRoutes<T extends IdTable, I extends z.ZodTypeAny, P extends z.ZodTypeAny>(opts: CrudOptions<T, I, P>) {
  const r = new Hono<AppBindings>();
  const createSchema = z.intersection(opts.input, z.object({ id: z.string().min(1).max(64).optional() }));

  r.get("/", (c) => {
    const items = liveRows(c.get("db"), opts.table);
    return c.json({ items: opts.sort ? items.sort(opts.sort) : items });
  });

  r.get("/:id", (c) => c.json({ item: requireLive(c.get("db"), opts.table, idParam(c), opts.label) }));

  r.post("/", async (c) => {
    const db = c.get("db");
    const body = (await parseBody(c, createSchema)) as Record<string, unknown> & { id?: string };
    const id = body.id ?? newId();
    if (getRow(db, opts.table, id)) throw new Conflict(`A ${opts.label} with this id already exists.`, "exists");
    const next = { ...(opts.defaults?.() ?? {}), ...body, id, updatedAt: new Date().toISOString(), deletedAt: null } as unknown as SyncRowMap[T];
    opts.guard?.(db, next, null);
    return c.json({ item: upsertRow(db, opts.table, next) }, 201);
  });

  r.patch("/:id", async (c) => {
    const db = c.get("db");
    const prev = requireLive(db, opts.table, idParam(c), opts.label);
    const patch = (await parseBody(c, opts.patch)) as Record<string, unknown>;
    const next = { ...prev, ...withoutUndefined(patch), id: prev.id, updatedAt: bumpUpdatedAt(prev.updatedAt) } as SyncRowMap[T];
    opts.guard?.(db, next, prev);
    return c.json({ item: upsertRow(db, opts.table, next) });
  });

  r.delete("/:id", (c) => {
    const db = c.get("db");
    const prev = requireLive(db, opts.table, idParam(c), opts.label);
    return c.json({ item: softDeleteRow(db, opts.table, prev.id, bumpUpdatedAt(prev.updatedAt)) });
  });

  return r;
}

// ---------------------------------------------------------------------------------------------
// Same routes for the REST-only tables (lib/local.service.ts). Rows are decoded to the core type
// (`Out`) for responses and encoded back for storage (JSON columns, derived columns).

type LiveMeta = { id: string; updatedAt: string; deletedAt: string | null };

export interface LocalCrudOptions<T extends LocalTable, Out extends LiveMeta, I extends z.ZodTypeAny, P extends z.ZodTypeAny> {
  table: T;
  input: I;
  patch: P;
  label: string;
  decode: (row: LocalRow<T>) => Out;
  encode: (item: Out) => LocalRow<T>;
  sort?: (a: Out, b: Out) => number;
  /** Shapes GET / (filter by query, map to summaries). Defaults to every live item. */
  list?: (items: Out[], query: Record<string, string>) => unknown[];
}

export function requireLocal<T extends LocalTable>(db: Db, table: T, id: string, label: string): LocalRow<T> {
  const row = getLocal(db, table, id);
  if (!row || row.deletedAt != null) throw new NotFound(`No such ${label}.`);
  return row;
}

export function localCrudRoutes<T extends LocalTable, Out extends LiveMeta, I extends z.ZodTypeAny, P extends z.ZodTypeAny>(
  opts: LocalCrudOptions<T, Out, I, P>,
) {
  const r = new Hono<AppBindings>();
  const createSchema = z.intersection(opts.input, z.object({ id: z.string().min(1).max(64).optional() }));
  const save = (db: Db, item: Out): Out => opts.decode(putLocal(db, opts.table, opts.encode(item)));

  r.get("/", (c) => {
    const items = allLocal(c.get("db"), opts.table, { includeDeleted: false }).map(opts.decode);
    if (opts.sort) items.sort(opts.sort);
    return c.json({ items: opts.list ? opts.list(items, c.req.query()) : items });
  });

  r.get("/:id", (c) => c.json({ item: opts.decode(requireLocal(c.get("db"), opts.table, idParam(c), opts.label)) }));

  r.post("/", async (c) => {
    const db = c.get("db");
    const body = (await parseBody(c, createSchema)) as Record<string, unknown> & { id?: string };
    const id = body.id ?? newId();
    if (getLocal(db, opts.table, id)) throw new Conflict(`A ${opts.label} with this id already exists.`, "exists");
    const item = { ...body, id, updatedAt: new Date().toISOString(), deletedAt: null } as unknown as Out;
    return c.json({ item: save(db, item) }, 201);
  });

  r.patch("/:id", async (c) => {
    const db = c.get("db");
    const prev = opts.decode(requireLocal(db, opts.table, idParam(c), opts.label));
    const patch = (await parseBody(c, opts.patch)) as Record<string, unknown>;
    const next = { ...prev, ...withoutUndefined(patch), id: prev.id, updatedAt: bumpUpdatedAt(prev.updatedAt) } as Out;
    return c.json({ item: save(db, next) });
  });

  r.delete("/:id", (c) => {
    const db = c.get("db");
    const prev = opts.decode(requireLocal(db, opts.table, idParam(c), opts.label));
    const at = bumpUpdatedAt(prev.updatedAt);
    return c.json({ item: save(db, { ...prev, updatedAt: at, deletedAt: at }) });
  });

  return r;
}
