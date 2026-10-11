import {
  canEditScoring,
  EDITABLE_FROM,
  isSettingKey,
  parseSettingValue,
  readSettings,
  todayIST,
  type ResolvedSettings,
  type SettingKey,
  type SettingRow,
} from "@tatakae/core";
import { transaction, type Db } from "./db";
import { BadRequest, Locked, NotFound } from "./errors";
import { allRows, bumpUpdatedAt, getRow, upsertRow } from "./rows.service";

/** Every known setting resolved over the defaults: `{ scoring: {...}, wake_time: "06:30", ... }`. */
export function getSettings(db: Db): ResolvedSettings {
  return readSettings(allRows(db, "settings"));
}

/** "even_sunday" keys are writable only when canEditScoring(todayIST()). */
export function isSettingWritable(key: string, existing: Pick<SettingRow, "editableFrom"> | null, now: Date = new Date()): boolean {
  const editableFrom = existing?.editableFrom ?? (isSettingKey(key) ? EDITABLE_FROM[key] : undefined) ?? null;
  return editableFrom !== "even_sunday" || canEditScoring(todayIST(now));
}

function decodeObject(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const v: unknown = JSON.parse(json);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * PUT /settings/:key. Unknown key → 404, invalid value → 400, scoring outside an even-week
 * Sunday → 423. `scoring` is a partial merged over the stored value.
 */
export function putSetting(
  db: Db,
  rawKey: string,
  value: unknown,
  now: Date = new Date(),
): { key: SettingKey; value: ResolvedSettings[SettingKey] } {
  if (!isSettingKey(rawKey)) throw new NotFound("No such setting.");
  const key: SettingKey = rawKey;
  return transaction(db, () => {
    const existing = getRow(db, "settings", key);
    if (!isSettingWritable(key, existing, now)) {
      throw new Locked("Scoring settings can only change on even-week Sundays.", "scoring_locked");
    }
    const merged =
      key === "scoring" && typeof value === "object" && value !== null && !Array.isArray(value)
        ? { ...decodeObject(existing?.deletedAt == null ? existing?.value : undefined), ...(value as Record<string, unknown>) }
        : value;
    const parsed = parseSettingValue(key, merged);
    if (!parsed.ok) throw new BadRequest(`Invalid value for ${key}: ${parsed.error}`, "invalid_setting");
    const row = upsertRow(db, "settings", {
      key,
      value: JSON.stringify(parsed.value),
      editableFrom: existing?.editableFrom ?? EDITABLE_FROM[key] ?? null,
      updatedAt: bumpUpdatedAt(existing?.updatedAt, now),
      deletedAt: null,
    });
    return { key, value: readSettings([row])[key] };
  });
}
