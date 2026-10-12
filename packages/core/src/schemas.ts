import { z } from "zod";
import { SYNC_TABLES, type SyncTable } from "./sync";
import type {
  Anchor, Area, Day, Experiment, FocusSession, Goal, Habit, HabitLog, InboxItem, Mission, MuraEvent, RechargeItem,
  Review, SettingRow, StoryRef, StuckEvent, SyncRowMap, WatchQueueItem,
} from "./types";

// Zod schemas for every API input/output and every synced row.
// Row schemas use the Drizzle property names (camelCase) and are checked against types.ts with
// `satisfies`, so a drift between the two fails typecheck.

// ===================== primitives =====================
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const isoTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "expected an ISO timestamp");
/** 24-hour wall-clock time "HH:MM". */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

export const dayKind = z.enum(["normal", "rest", "write_off"]);
export const slot = z.enum(["P1", "P2", "P3", "side", "backlog"]);
export const missionStatus = z.enum(["open", "done", "minimum", "missed", "rescheduled", "backlog"]);
export const blocker = z.enum(["uncertainty", "fear", "inertia"]);
export const reviewType = z.enum(["week", "month", "cycle"]);
export const storyMedium = z.enum(["anime", "film", "series", "kdrama", "book"]);
export const storyMoment = z.enum([
  "p1_done", "minimum_done", "comeback", "stuck_fear", "stuck_inertia", "weekly_review", "cycle_start", "rest_day",
]);
export const goalStatus = z.enum(["active", "paused", "done", "dropped"]);
export const watchStatus = z.enum(["queued", "watching", "done", "dropped"]);
export const focusLength = z.union([z.literal(25), z.literal(50), z.literal(90)]);
export const clientKind = z.enum(["web", "mobile"]);
export const syncTable = z.enum(SYNC_TABLES);

const text = (max: number) => z.string().max(max);
const optText = (max: number) => z.string().max(max).nullable();
const rowMeta = { updatedAt: isoTime, deletedAt: isoTime.nullable() };
/** Row schemas may carry extra output keys but must produce every field of the interface. */
type RowSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

// ===================== v1 rows =====================
export const dayRow = z.object({
  date: isoDate,
  kind: dayKind,
  screenMin: z.number().int().min(0).max(1440).nullable(),
  smallWin: optText(200),
  qP1: optText(300),
  qDrift: optText(300),
  qPractised: optText(300),
  intention: optText(200),
  energy: z.number().int().min(1).max(5).nullable(),
  forgedAt: isoTime.nullable(),
  ...rowMeta,
}) satisfies RowSchema<Day>;

export const missionRow = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  dayDate: isoDate.nullable(),
  slot,
  points: z.number().int().min(1).max(5).nullable(),
  status: missionStatus,
  minimum: optText(200),
  ifThen: optText(300),
  resumeNote: optText(500),
  goalId: z.string().nullable(),
  estMin: z.number().int().positive().nullable(),
  actualMin: z.number().int().nonnegative().nullable(),
  plannedStart: hhmm.nullable().optional(), // v2 week planner
  rescheduleCount: z.number().int().nonnegative(),
  ...rowMeta,
}) satisfies RowSchema<Mission>;

export const habitRow = z.object({
  id: z.string().min(1),
  anchor: optText(200),
  behaviour: z.string().min(1).max(200),
  minimum: optText(200),
  frequency: z.string().min(1).max(50),
  areaId: z.string().nullable(),
  active: z.boolean(),
  ...rowMeta,
}) satisfies RowSchema<Habit>;

export const habitLogRow = z.object({
  habitId: z.string().min(1),
  date: isoDate,
  done: z.boolean(),
  ...rowMeta,
}) satisfies RowSchema<HabitLog>;

export const anchorRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  startTime: hhmm,
  endTime: hhmm,
  weekdays: z.string().regex(/^([0-6](,[0-6])*)?$/, "comma-separated 0..6 (0 = Sun)"),
  ...rowMeta,
}) satisfies RowSchema<Anchor>;

export const settingRow = z.object({
  key: z.string().min(1).max(100),
  value: z.string(), // JSON text; validate with parseSettingValue
  editableFrom: z.string().nullable(),
  ...rowMeta,
}) satisfies RowSchema<SettingRow>;

export const inboxRow = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(1000),
  createdAt: isoTime,
  processed: z.boolean(),
  ...rowMeta,
}) satisfies RowSchema<InboxItem>;

export const muraEventRow = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  reason: z.string().min(1).max(300),
  at: isoTime,
  ...rowMeta,
}) satisfies RowSchema<MuraEvent>;

export const focusSessionRow = z.object({
  id: z.string().min(1),
  missionId: z.string().nullable(),
  areaId: z.string().nullable(),
  startedAt: isoTime,
  endedAt: isoTime.nullable(),
  plannedMin: z.number().int().positive().max(600),
  completed: z.boolean(),
  ...rowMeta,
}) satisfies RowSchema<FocusSession>;

// ===================== v2 rows =====================
export const stuckEventRow = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  blocker,
  unblocker: optText(300),
  at: isoTime,
  ...rowMeta,
}) satisfies RowSchema<StuckEvent>;

export const rechargeItemRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  kind: optText(30),
  ...rowMeta,
}) satisfies RowSchema<RechargeItem>;

export const areaRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  standard: optText(300),
  why: optText(500),
  alignmentScore: z.number().int().min(0).max(10).nullable(),
  color: optText(30).optional(), // sage | rose | butter | sky | lime-soft | lavender-soft
  icon: optText(60).optional(),  // lucide name, see icons.ts
  ...rowMeta,
}) satisfies RowSchema<Area>;

export const goalRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  areaId: z.string().nullable(),
  status: goalStatus,
  intent: optText(500),
  outcome: optText(500),
  niceGoal: optText(500),
  nextAction: optText(300),
  why: optText(500),
  hellYeah: z.boolean(),
  targetPoints: z.number().int().positive().nullable().optional(), // ring progress
  start: isoDate.nullable(),
  end: isoDate.nullable(),
  ...rowMeta,
}) satisfies RowSchema<Goal>;

export const reviewRow = z.object({
  id: z.string().min(1),
  type: reviewType,
  periodStart: isoDate,
  periodEnd: isoDate,
  wins: optText(2000),
  failed: optText(2000),
  why: optText(2000),
  muri: optText(2000),
  mura: optText(2000),
  muda: optText(2000),
  diagnosis: optText(2000),
  bottleneck: optText(1000),
  capacity: z.number().int().min(0).max(10).nullable(),
  burnout: z.number().int().min(0).max(10).nullable(),
  capability: z.number().int().min(0).max(10).nullable(),
  theme: optText(200),
  ...rowMeta,
}) satisfies RowSchema<Review>;

export const experimentRow = z.object({
  id: z.string().min(1),
  hypothesis: z.string().min(1).max(500),
  change: z.string().min(1).max(500),
  start: isoDate,
  end: isoDate,
  result: optText(1000),
  decision: optText(500),
  ...rowMeta,
}) satisfies RowSchema<Experiment>;

export const storyRefRow = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  medium: storyMedium,
  character: optText(100),
  lesson: z.string().min(1).max(160), // paraphrase only
  moment: storyMoment,
  yourLine: optText(160),
  muted: z.boolean(),
  lastShownAt: isoTime.nullable(),
  ...rowMeta,
}) satisfies RowSchema<StoryRef>;

export const watchQueueRow = z.object({
  title: z.string().min(1).max(200),
  totalEpisodes: z.number().int().positive().nullable(),
  watched: z.number().int().nonnegative(),
  unlocked: z.number().int().nonnegative(),
  status: watchStatus,
  ...rowMeta,
}) satisfies RowSchema<WatchQueueItem>;

/** Row schema per synced table; the API validates every incoming sync row with this. */
export const rowSchemas: { readonly [T in SyncTable]: RowSchema<SyncRowMap[T]> } = {
  days: dayRow,
  missions: missionRow,
  habits: habitRow,
  habit_logs: habitLogRow,
  anchors: anchorRow,
  settings: settingRow,
  inbox: inboxRow,
  mura_events: muraEventRow,
  focus_sessions: focusSessionRow,
  stuck_events: stuckEventRow,
  recharge_items: rechargeItemRow,
  areas: areaRow,
  goals: goalRow,
  reviews: reviewRow,
  experiments: experimentRow,
  story_refs: storyRefRow,
  watch_queue: watchQueueRow,
};

// ===================== v1 inputs (REST) =====================
export const missionInput = z.object({
  title: z.string().min(1).max(200),
  dayDate: isoDate.nullable(),
  slot,
  points: z.number().int().min(1).max(5).nullable().default(null),
  minimum: z.string().max(200).nullable().default(null),
  ifThen: z.string().max(300).nullable().default(null),
  goalId: z.string().nullable().default(null),
  estMin: z.number().int().positive().nullable().default(null),
});

export const missionPatch = missionInput.partial().extend({
  status: missionStatus.optional(),
  resumeNote: z.string().max(500).nullable().optional(),
  actualMin: z.number().int().nonnegative().nullable().optional(),
});

/** P1 is forge-ready only with a Minimum and an if-then plan. Drafts may be incomplete. */
export function p1Ready(m: { slot: string; minimum?: string | null; ifThen?: string | null }): boolean {
  if (m.slot !== "P1") return true;
  return !!m.minimum?.trim() && !!m.ifThen?.trim();
}

/** missionInput that must already satisfy the P1 rule (use when forging, not for drafts). */
export const missionForgeReady = missionInput.refine(p1Ready, {
  message: "P1 needs a Minimum version and an if-then plan",
  path: ["ifThen"],
});

export type ForgeProblem = "no_p1" | "p1_missing_minimum" | "p1_missing_if_then" | "duplicate_slot" | "too_many_side";
export type ForgeMission = Pick<Mission, "slot" | "status" | "minimum" | "ifThen"> & { deletedAt?: string | null };

/**
 * Forge validation for a day's missions (ignores soft-deleted and rescheduled ones):
 * exactly one P1 with Minimum + if-then, at most one each of P1/P2/P3 and one side quest.
 */
export function validateForge(missions: readonly ForgeMission[]): ForgeProblem[] {
  const live = missions.filter((m) => m.deletedAt == null && m.status !== "rescheduled" && m.status !== "backlog");
  const problems: ForgeProblem[] = [];
  const count = (s: string) => live.filter((m) => m.slot === s).length;
  const p1 = live.find((m) => m.slot === "P1");
  if (!p1) problems.push("no_p1");
  else {
    if (!p1.minimum?.trim()) problems.push("p1_missing_minimum");
    if (!p1.ifThen?.trim()) problems.push("p1_missing_if_then");
  }
  if (count("P1") > 1 || count("P2") > 1 || count("P3") > 1) problems.push("duplicate_slot");
  if (count("side") > 1) problems.push("too_many_side");
  return problems;
}

export const lockedEdit = z.object({
  reason: z.string().min(3).max(300), // stored as mura event
  patch: missionPatch,
});

export const dayPatch = z.object({
  kind: dayKind.optional(),
  screenMin: z.number().int().min(0).max(1440).nullable().optional(),
  smallWin: z.string().max(200).nullable().optional(),
  qP1: z.string().max(300).nullable().optional(),
  qDrift: z.string().max(300).nullable().optional(),
  qPractised: z.string().max(300).nullable().optional(),
  intention: z.string().max(200).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
});

/** Write-off needs a reason (max 2 per month, enforced by the API). */
export const writeOffInput = z.object({ reason: z.string().min(3).max(300) });

export const habitInput = z.object({
  anchor: z.string().max(200).nullable().default(null),
  behaviour: z.string().min(1).max(200),
  minimum: z.string().max(200).nullable().default(null),
  frequency: z.string().min(1).max(50).default("daily"),
  areaId: z.string().nullable().default(null),
  active: z.boolean().default(true),
});
export const habitPatch = habitInput.partial();
export const habitLogInput = z.object({ done: z.boolean() });

export const anchorInput = anchorRow.pick({ name: true, startTime: true, endTime: true, weekdays: true });

export const inboxInput = z.object({ text: z.string().min(1).max(1000) });
export const inboxPatch = z.object({ text: z.string().min(1).max(1000).optional(), processed: z.boolean().optional() });

/** POST /focus: start a block (startedAt defaults to server time). */
export const focusInput = z.object({
  missionId: z.string().nullable().default(null),
  areaId: z.string().nullable().default(null),
  startedAt: isoTime.optional(),
  plannedMin: z.number().int().positive().max(600),
});
/** PATCH /focus/:id: end a block (completed = ran to the end) or relink it. */
export const focusPatch = z.object({
  missionId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  endedAt: isoTime.nullable().optional(),
  completed: z.boolean().optional(),
});

/** GET /stats/series query. */
export const seriesQuery = z.object({
  metric: z.enum(["final", "screen_min", "focus_min"]),
  days: z.coerce.number().int().min(1).max(400).default(14),
});

export const stuckInput = z.object({
  missionId: z.string(),
  blocker,
  unblocker: z.string().max(300).nullable(),
});

// ===================== settings =====================
export const scoringSettingsPartial = z
  .object({
    screenFreeMin: z.number().nonnegative(),
    screenStepMin: z.number().positive(),
    screenStepPenalty: z.number().nonnegative(),
    screenPenaltyCap: z.number().nonnegative(),
    comebackBonus: z.number().nonnegative(),
    strongAt: z.number().min(0).max(100),
    solidAt: z.number().min(0).max(100),
    missedExecBelow: z.number().min(0).max(100),
    capacityRatio: z.number().min(0).max(1),
    writeOffsPerMonth: z.number().int().min(0).max(31),
  })
  .partial();

/** Value schema per known settings key (values are stored JSON-encoded in settings.value). */
export const settingValueSchemas = {
  scoring: scoringSettingsPartial, // editable_from = "even_sunday"
  wake_time: hhmm,
  ritual_time: hhmm,
  focus_default: focusLength,
  story_enabled: z.boolean(),
  haptics_enabled: z.boolean(),
  afternoon_nudge: z.object({ enabled: z.boolean(), time: hhmm }),
  focus_week_target: z.number().int().min(0).max(5000), // minutes; scoreboard "Focus minutes (week)" bar
} as const;

export type SettingKey = keyof typeof settingValueSchemas;
export type SettingValues = { [K in SettingKey]: z.infer<(typeof settingValueSchemas)[K]> };

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(settingValueSchemas, key);
}

/** PUT /settings/:key body. */
export const settingPut = z.object({ value: z.unknown() });

// ===================== v2 inputs =====================
/** Max active goals per 12-week cycle (CYCLE_1.maxGoals). The API enforces it; each goal must pass the hell-yeah gate. */
export const MAX_ACTIVE_GOALS = 4;

export const goalInput = z.object({
  name: z.string().min(1).max(200),
  areaId: z.string().nullable().default(null),
  status: goalStatus.default("active"),
  intent: z.string().max(500).nullable().default(null),
  outcome: z.string().max(500).nullable().default(null),
  niceGoal: z.string().max(500).nullable().default(null),
  nextAction: z.string().max(300).nullable().default(null),
  why: z.string().max(500).nullable().default(null),
  hellYeah: z.boolean().default(false),
  start: isoDate.nullable().default(null),
  end: isoDate.nullable().default(null),
});
export const goalPatch = goalInput.partial();

export const areaInput = z.object({
  name: z.string().min(1).max(100),
  standard: z.string().max(300).nullable().default(null),
  why: z.string().max(500).nullable().default(null),
  alignmentScore: z.number().int().min(0).max(10).nullable().default(null),
});
export const areaPatch = areaInput.partial();

export const reviewInput = reviewRow.omit({ id: true, updatedAt: true, deletedAt: true });
export const reviewPatch = reviewInput.partial();

/** One experiment at a time, two weeks by default (end = start + 13 days). */
export const experimentInput = z.object({
  hypothesis: z.string().min(1).max(500),
  change: z.string().min(1).max(500),
  start: isoDate,
  end: isoDate,
  result: z.string().max(1000).nullable().default(null),
  decision: z.string().max(500).nullable().default(null),
});
export const experimentPatch = experimentInput.partial();

export const storyRefInput = z.object({
  title: z.string().min(1).max(200),
  medium: storyMedium,
  character: z.string().max(100).nullable().default(null),
  lesson: z.string().min(1).max(160), // your own paraphrase, never a quote
  moment: storyMoment,
  yourLine: z.string().max(160).nullable().default(null),
});
export const storyRefPatch = storyRefInput.partial().extend({ muted: z.boolean().optional() });

/** Reference pack file (references/*.local.json), imported in Settings → Story. */
export const storyPack = z.object({
  version: z.literal(1),
  refs: z.array(storyRefInput).max(2000),
});

export const storyNextQuery = z.object({ moment: storyMoment });

export const watchQueueInput = z.object({
  title: z.string().min(1).max(200),
  totalEpisodes: z.number().int().positive().nullable().default(null),
  watched: z.number().int().nonnegative().default(0),
  unlocked: z.number().int().nonnegative().default(0),
  status: watchStatus.default("queued"),
});

// ===================== v3 inputs =====================
export const noteInput = z.object({
  title: z.string().min(1).max(300),
  type: z.string().max(50).nullable().default(null),
  status: z.string().max(50).nullable().default(null),
  tags: z.array(z.string().min(1).max(50)).max(30).default([]),
  areaId: z.string().nullable().default(null),
  goalId: z.string().nullable().default(null),
  sourceUrl: z.string().url().max(2000).nullable().default(null),
  bodyJson: z.array(z.unknown()).nullable().default(null), // BlockNote document (array of blocks)
  canExplain: z.boolean().nullable().default(null),
  canImplement: z.boolean().nullable().default(null),
  misunderstood: z.string().max(2000).nullable().default(null),
  publishedUrl: z.string().url().max(2000).nullable().default(null),
});
export const notePatch = noteInput.partial();
export const noteSearchQuery = z.object({ q: z.string().min(1).max(200) });

// ===================== sync =====================
export const outboxItem = z.object({
  id: z.string(),
  table: syncTable,
  op: z.enum(["upsert", "delete"]), // delete = soft delete (deletedAt = updatedAt)
  row: z.record(z.unknown()),
  updatedAt: z.string(),
  meta: z.object({ lockReason: z.string().min(3).max(300).optional() }).optional(),
});

export const syncRequest = z.object({
  client: clientKind,
  cursor: z.string().nullable(),
  items: z.array(outboxItem).max(500),
});

export const syncConflict = z.object({
  id: z.string(), // outbox item id
  server: z.record(z.unknown()).nullable(), // current server row; null when none exists (rejected create)
});

export const syncResponse = z.object({
  applied: z.array(z.string()),
  conflicts: z.array(syncConflict),
  changes: z.array(z.object({ table: syncTable, row: z.record(z.unknown()) })),
  cursor: z.string(),
});

// ===================== auth =====================
export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  client: clientKind,
  deviceName: z.string().min(1).max(40), // "laptop-1", "laptop-2", "phone"
});
export const loginMobileResponse = z.object({ token: z.string(), expiresAt: z.string() });

// ===================== inferred types =====================
export type OutboxItem = z.infer<typeof outboxItem>;
export type SyncRequest = z.infer<typeof syncRequest>;
export type SyncResponse = z.infer<typeof syncResponse>;
export type SyncConflict = z.infer<typeof syncConflict>;
export type ClientKind = z.infer<typeof clientKind>;
export type MissionInput = z.infer<typeof missionInput>;
export type MissionPatch = z.infer<typeof missionPatch>;
export type LockedEdit = z.infer<typeof lockedEdit>;
export type DayPatch = z.infer<typeof dayPatch>;
export type WriteOffInput = z.infer<typeof writeOffInput>;
export type HabitInput = z.infer<typeof habitInput>;
export type HabitPatch = z.infer<typeof habitPatch>;
export type AnchorInput = z.infer<typeof anchorInput>;
export type InboxInput = z.infer<typeof inboxInput>;
export type InboxPatch = z.infer<typeof inboxPatch>;
export type StuckInput = z.infer<typeof stuckInput>;
export type FocusInput = z.infer<typeof focusInput>;
export type FocusPatch = z.infer<typeof focusPatch>;
export type ScoringSettingsPartial = z.infer<typeof scoringSettingsPartial>;
export type GoalInput = z.infer<typeof goalInput>;
export type AreaInput = z.infer<typeof areaInput>;
export type ReviewInput = z.infer<typeof reviewInput>;
export type ExperimentInput = z.infer<typeof experimentInput>;
export type StoryRefInput = z.infer<typeof storyRefInput>;
export type StoryPack = z.infer<typeof storyPack>;
export type WatchQueueInput = z.infer<typeof watchQueueInput>;
export type NoteInput = z.infer<typeof noteInput>;
export type NotePatch = z.infer<typeof notePatch>;
export type LoginInput = z.infer<typeof loginInput>;
export type LoginMobileResponse = z.infer<typeof loginMobileResponse>;
