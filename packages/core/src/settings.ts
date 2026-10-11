import { DEFAULT_SCORING, scoringFromSettings } from "./scoring";
import { isSettingKey, settingValueSchemas, type SettingKey, type SettingValues } from "./schemas";
import type { RechargeItem, ScoringSettings, SettingRow } from "./types";

// Settings defaults + parsing. db/seed.sql holds the same values; keep the two identical.

/** Fully resolved settings (scoring merged over defaults). */
export type ResolvedSettings = Omit<SettingValues, "scoring"> & { scoring: ScoringSettings };

export const DEFAULT_SETTINGS: ResolvedSettings = {
  scoring: DEFAULT_SCORING,
  wake_time: "06:30",
  ritual_time: "21:30",
  focus_default: 50,
  story_enabled: true,
  haptics_enabled: true,
  afternoon_nudge: { enabled: false, time: "14:00" },
};

/** Keys whose rows are only writable when canEditScoring(todayIST()). */
export const EDITABLE_FROM: Partial<Record<SettingKey, "even_sunday">> = { scoring: "even_sunday" };

/** updatedAt of seeded rows: the epoch, so any real edit wins LWW. */
export const SEED_UPDATED_AT = "1970-01-01T00:00:00.000Z";

/** Recharge menu defaults with fixed ULID-shaped ids (same ids in db/seed.sql). */
export const DEFAULT_RECHARGE_ITEMS: readonly Pick<RechargeItem, "id" | "name" | "kind">[] = [
  { id: "0000000000RECHARGE00000001", name: "Walk", kind: "walk" },
  { id: "0000000000RECHARGE00000002", name: "Music", kind: "music" },
  { id: "0000000000RECHARGE00000003", name: "Call", kind: "call" },
  { id: "0000000000RECHARGE00000004", name: "Stretch", kind: "stretch" },
  { id: "0000000000RECHARGE00000005", name: "Sketch", kind: "sketch" },
];

/** Settings rows to insert-if-missing on first boot. */
export function defaultSettingRows(updatedAt: string = SEED_UPDATED_AT): SettingRow[] {
  return (Object.keys(DEFAULT_SETTINGS) as SettingKey[]).map((key) => ({
    key,
    value: JSON.stringify(DEFAULT_SETTINGS[key]),
    editableFrom: EDITABLE_FROM[key] ?? null,
    updatedAt,
    deletedAt: null,
  }));
}

/** Recharge rows to insert-if-missing on first boot. */
export function defaultRechargeRows(updatedAt: string = SEED_UPDATED_AT): RechargeItem[] {
  return DEFAULT_RECHARGE_ITEMS.map((r) => ({ ...r, updatedAt, deletedAt: null }));
}

/**
 * Validate a settings value (already JSON-decoded) for a known key.
 * Returns `{ ok: false }` for unknown keys or invalid values.
 */
export function parseSettingValue<K extends SettingKey>(
  key: K,
  value: unknown,
): { ok: true; value: SettingValues[K] } | { ok: false; error: string } {
  const res = settingValueSchemas[key].safeParse(value);
  if (!res.success) return { ok: false, error: res.error.issues.map((i) => i.message).join("; ") };
  return { ok: true, value: res.data as SettingValues[K] };
}

/**
 * Resolve typed settings from stored rows: each known key falls back to its default when the row
 * is missing, deleted, not valid JSON or fails validation. `scoring` is merged over DEFAULT_SCORING.
 */
export function readSettings(rows: readonly Pick<SettingRow, "key" | "value" | "deletedAt">[]): ResolvedSettings {
  const out: ResolvedSettings = { ...DEFAULT_SETTINGS, scoring: { ...DEFAULT_SCORING } };
  const target = out as Record<SettingKey, unknown>;
  for (const row of rows) {
    if (row.deletedAt != null || !isSettingKey(row.key)) continue;
    let decoded: unknown;
    try {
      decoded = JSON.parse(row.value);
    } catch {
      continue;
    }
    const parsed = parseSettingValue(row.key, decoded);
    if (!parsed.ok) continue;
    target[row.key] = row.key === "scoring" ? scoringFromSettings(parsed.value) : parsed.value;
  }
  return out;
}
