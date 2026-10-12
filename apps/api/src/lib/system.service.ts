import { desc } from "drizzle-orm";
import { SYNC_TABLES } from "@tatakae/core";
import { jobRuns } from "../../../../db/schema";
import type { Db } from "./db";
import { newId } from "./ids";
import { allLocal, LOCAL_TABLES, type LocalTable } from "./local.service";
import { decodeNote } from "./notes.service";
import { allRows } from "./rows.service";

// v4 system: full JSON export (GET /export, nightly backup) and the job log (job_runs).

export const EXPORT_FORMAT = 1;

/** Tables that never leave the server: auth secrets and sync bookkeeping. */
export const NOT_EXPORTED = ["sessions", "changes", "sync_items", "push_subscriptions"] as const;

export interface ExportFile {
  app: "tatakae";
  format: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * Every row the owner wrote, soft-deleted ones included, as camelCase JSON (notes with their
 * BlockNote body decoded). File bytes are not inlined; `files` lists their metadata and keys.
 */
export function buildExport(db: Db, now: Date = new Date()): ExportFile {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = allRows(db, t);
  for (const t of Object.keys(LOCAL_TABLES) as LocalTable[]) {
    tables[t] = t === "notes" ? allLocal(db, "notes").map(decodeNote) : allLocal(db, t);
  }
  tables["job_runs"] = db.select().from(jobRuns).all();
  return { app: "tatakae", format: EXPORT_FORMAT, exportedAt: now.toISOString(), tables };
}

export type JobRun = typeof jobRuns.$inferSelect;

export function recordJob(db: Db, job: string, startedAt: Date, ok: boolean, detail: string | null): JobRun {
  const at = new Date().toISOString();
  const row: JobRun = { id: newId(), job, startedAt: startedAt.toISOString(), ok, detail: detail?.slice(0, 500) ?? null, updatedAt: at, deletedAt: null };
  db.insert(jobRuns).values(row).run();
  return row;
}

export function listJobs(db: Db, limit = 50): JobRun[] {
  return db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(limit).all();
}
