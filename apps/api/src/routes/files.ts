import { Hono } from "hono";
import { z } from "zod";
import type { FileMeta } from "@tatakae/core";
import type { AppBindings } from "../env";
import { requireLocal } from "../lib/crud";
import { BadRequest, HttpError, NotFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { allLocal, putLocal, type LocalRow } from "../lib/local.service";
import { bumpUpdatedAt } from "../lib/rows.service";
import { putObject, readLocal, writeLocal } from "../lib/storage";
import { stratusConfigured, stratusGet, stratusPut } from "../lib/stratus";
import { idParam, parseQuery } from "../lib/validate";

// Phase v3. Note attachments (REST only).
//   POST   /files          multipart: file (≤ 20 MB), noteId? → 201 { item: FileMeta, offsite }
//   GET    /files?noteId=  → { items }
//   GET    /files/:id      → the bytes (images/PDF/text inline, anything else as a download)
//   DELETE /files/:id      → { item } (soft delete; the bytes stay on disk for restores)
// VM: bytes go to FILES_DIR/files/<id>, then to Object Storage under the same key when configured; an
// Object Storage failure is logged and reported as `offsite: false`, the upload still succeeds.
// Zoho Catalyst (STRATUS_BUCKET_URL): the disk is only a cache, so Stratus is where the file lives:
// the upload fails (503) if Stratus does, and reads fall back to Stratus when the cache is empty.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Served inline; everything else is an attachment so uploaded HTML/SVG can never run as our origin. */
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf|text\/plain)$/;

type FileDb = LocalRow<"files">;

const decode = (r: FileDb): FileMeta => ({
  id: r.id,
  name: r.name ?? r.id,
  noteId: r.noteId,
  mime: r.mime,
  size: r.size,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});

/** Keep a readable, header-safe filename. */
export function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 200);
  return clean || "file";
}

export const files = new Hono<AppBindings>();

files.post("/", async (c) => {
  const env = c.get("env");
  const db = c.get("db");
  const len = Number(c.req.header("content-length") ?? "0");
  if (len > MAX_FILE_BYTES + 64 * 1024) throw new HttpError(413, "too_large", "Files up to 20 MB.");
  let form: Record<string, string | File | (string | File)[]>;
  try {
    form = await c.req.parseBody({ all: false });
  } catch {
    throw new BadRequest("Send multipart/form-data with a `file` field.", "invalid_multipart");
  }
  const file = form["file"];
  if (!(file instanceof File)) throw new BadRequest("Send multipart/form-data with a `file` field.", "invalid_multipart");
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "too_large", "Files up to 20 MB.");
  const noteIdRaw = form["noteId"];
  const noteId = typeof noteIdRaw === "string" && noteIdRaw ? noteIdRaw : null;
  if (noteId) requireLocal(db, "notes", noteId, "note");

  const id = newId();
  const key = `files/${id}`;
  const mime = (file.type || "application/octet-stream").slice(0, 100);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (stratusConfigured(env)) {
    try {
      await stratusPut(env, key, bytes, mime);
    } catch (e) {
      console.error(`files: Stratus upload of ${key} failed:`, e instanceof Error ? e.message : e);
      throw new HttpError(503, "storage_unavailable", "Couldn't store the file right now. Try again in a moment.");
    }
  }
  await writeLocal(env, key, bytes);

  let offsite = stratusConfigured(env);
  try {
    offsite = (await putObject(env, key, bytes, mime)) || offsite;
  } catch (e) {
    console.error(`files: Object Storage copy of ${key} failed:`, e instanceof Error ? e.message : e);
  }

  const now = new Date().toISOString();
  const row = putLocal(db, "files", {
    id,
    r2Key: key,
    name: cleanName(file.name),
    noteId,
    mime,
    size: bytes.byteLength,
    updatedAt: now,
    deletedAt: null,
  });
  return c.json({ item: decode(row), offsite }, 201);
});

files.get("/", (c) => {
  const { noteId } = parseQuery(c, z.object({ noteId: z.string().min(1).optional() }));
  const items = allLocal(c.get("db"), "files", { includeDeleted: false })
    .filter((f) => !noteId || f.noteId === noteId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(decode);
  return c.json({ items });
});

files.get("/:id", async (c) => {
  const env = c.get("env");
  const row = requireLocal(c.get("db"), "files", idParam(c), "file");
  let bytes: Uint8Array | null = await readLocal(env, row.r2Key);
  if (!bytes && stratusConfigured(env)) {
    try {
      bytes = await stratusGet(env, row.r2Key);
    } catch (e) {
      console.error(`files: Stratus download of ${row.r2Key} failed:`, e instanceof Error ? e.message : e);
      throw new HttpError(503, "storage_unavailable", "Couldn't fetch the file right now. Try again in a moment.");
    }
    if (bytes) await writeLocal(env, row.r2Key, bytes).catch(() => undefined); // warm the cache
  }
  if (!bytes) throw new NotFound("The file is missing from storage. Restore it from a backup.", "file_missing");
  const inline = INLINE.test(row.mime);
  const name = encodeURIComponent(row.name ?? row.id);
  return c.body(new Uint8Array(bytes), 200, {
    "content-type": inline ? row.mime : "application/octet-stream",
    "content-length": String(bytes.byteLength),
    "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox; default-src 'none'",
    "cache-control": "private, max-age=31536000, immutable",
  });
});

files.delete("/:id", (c) => {
  const db = c.get("db");
  const prev = requireLocal(db, "files", idParam(c), "file");
  const at = bumpUpdatedAt(prev.updatedAt);
  return c.json({ item: decode(putLocal(db, "files", { ...prev, updatedAt: at, deletedAt: at })) });
});
