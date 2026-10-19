import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { todayIST } from "@tatakae/core";
import type { Env } from "../env";
import type { Db } from "../lib/db";
import { offsiteConfigured, uploadBackup } from "../lib/storage";
import { stratusConfigured, stratusPut } from "../lib/stratus";
import { buildExport, recordJob } from "../lib/system.service";

/**
 * Second backup layer (Litestream is the first). Every night: the full JSON export →
 * BACKUP_DIR/YYYY-MM-DD.json (newest 7 kept) and Object Storage backups/YYYY-MM-DD.json (newest 30).
 * The result goes to `job_runs` (Settings → Data). Never throws: a failed run is logged, not fatal.
 */
export const LOCAL_KEEP = 7;
export const OFFSITE_KEEP = 30;

export function backupDir(env: Env): string {
  return resolve(env.BACKUP_DIR ?? join(dirname(resolve(env.DATABASE_PATH)), "backups"));
}

export async function runBackup(env: Env, db: Db, now: Date = new Date()): Promise<boolean> {
  const started = now;
  const name = `${todayIST(now)}.json`;
  try {
    const json = JSON.stringify(buildExport(db, now));
    const dir = backupDir(env);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), json, { mode: 0o600 });
    const old = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(LOCAL_KEEP);
    for (const f of old) await rm(join(dir, f), { force: true });

    const offsite = await uploadBackup(env, `backups/${name}`, json, OFFSITE_KEEP);
    // Zoho Catalyst: Stratus deletes each copy after OFFSITE_KEEP days by itself (no listing needed).
    if (stratusConfigured(env)) {
      await stratusPut(env, `backups/${name}`, new TextEncoder().encode(json), "application/json", { expiresAfterSec: OFFSITE_KEEP * 86_400 });
    }
    const kb = Math.round(json.length / 1024);
    const where = [offsiteConfigured(env) && "Object Storage", stratusConfigured(env) && "Stratus"].filter(Boolean).join(" + ");
    const detail = where
      ? `${kb} KB; local + ${where}${offsite.pruned ? `, pruned ${offsite.pruned}` : ""}`
      : `${kb} KB; local only (no off-box storage configured)`;
    recordJob(db, "backup", started, true, detail);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup] failed:", msg);
    try {
      recordJob(db, "backup", started, false, msg);
    } catch {
      // the database itself may be the problem; the console line above is the record
    }
    return false;
  }
}
