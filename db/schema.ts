import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Drizzle schema for SQLite (better-sqlite3 on the Oracle VM). Column names match docs/07-data-and-api.md.
// Conventions: ULID text ids, IST date strings, updated_at on every row, soft delete via deleted_at.

const meta = {
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
};

// ===================== v1 =====================
export const days = sqliteTable("days", {
  date: text("date").primaryKey(),
  kind: text("kind", { enum: ["normal", "rest", "write_off"] }).notNull().default("normal"),
  screenMin: integer("screen_min"),
  smallWin: text("small_win"),
  qP1: text("q_p1"),
  qDrift: text("q_drift"),
  qPractised: text("q_practised"),
  intention: text("intention"),
  energy: integer("energy"),
  forgedAt: text("forged_at"),
  ...meta,
});

export const missions = sqliteTable("missions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  dayDate: text("day_date"),
  slot: text("slot", { enum: ["P1", "P2", "P3", "side", "backlog"] }).notNull(),
  points: integer("points"),
  status: text("status", { enum: ["open", "done", "minimum", "missed", "rescheduled", "backlog"] }).notNull().default("open"),
  minimum: text("minimum"),
  ifThen: text("if_then"),
  resumeNote: text("resume_note"),
  goalId: text("goal_id"),
  estMin: integer("est_min"),
  actualMin: integer("actual_min"),
  rescheduleCount: integer("reschedule_count").notNull().default(0),
  ...meta,
});

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  anchor: text("anchor"),        // "After I ..."
  behaviour: text("behaviour").notNull(),
  minimum: text("minimum"),
  frequency: text("frequency").notNull().default("daily"),
  areaId: text("area_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...meta,
});

export const habitLogs = sqliteTable("habit_logs", {
  habitId: text("habit_id").notNull(),
  date: text("date").notNull(),
  done: integer("done", { mode: "boolean" }).notNull(),
  ...meta,
}, (t) => ({ pk: primaryKey({ columns: [t.habitId, t.date] }) }));

export const anchors = sqliteTable("anchors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),
  weekdays: text("weekdays").notNull(),    // "1,2,3,4,5"
  ...meta,
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),          // JSON
  editableFrom: text("editable_from"),     // e.g. "even_sunday"
  ...meta,
});

export const inbox = sqliteTable("inbox", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  ...meta,
});

export const muraEvents = sqliteTable("mura_events", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  reason: text("reason").notNull(),
  at: text("at").notNull(),
  ...meta,
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),          // random 32 bytes, hashed
  client: text("client", { enum: ["web", "mobile"] }).notNull(),
  deviceName: text("device_name").notNull(), // "laptop-1", "laptop-2", "phone" — Settings → Devices
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  ...meta,
});

export const jobRuns = sqliteTable("job_runs", {
  id: text("id").primaryKey(),
  job: text("job").notNull(),           // backup | morning_push
  startedAt: text("started_at").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  detail: text("detail"),
  ...meta,
});

// ===================== v2 =====================
// TODO(v2): fill columns per docs/07-data-and-api.md.
export const areas = sqliteTable("areas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  standard: text("standard"),
  why: text("why"),
  alignmentScore: integer("alignment_score"),
  ...meta,
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  areaId: text("area_id"),
  status: text("status").notNull().default("active"),
  intent: text("intent"),
  outcome: text("outcome"),
  niceGoal: text("nice_goal"),
  nextAction: text("next_action"),
  why: text("why"),
  hellYeah: integer("hell_yeah", { mode: "boolean" }).notNull().default(false),
  start: text("start"),
  end: text("end"),
  ...meta,
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["week", "month", "cycle"] }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  wins: text("wins"),
  failed: text("failed"),
  why: text("why"),
  muri: text("muri"),
  mura: text("mura"),
  muda: text("muda"),
  diagnosis: text("diagnosis"),
  bottleneck: text("bottleneck"),
  capacity: integer("capacity"),
  burnout: integer("burnout"),
  capability: integer("capability"),
  theme: text("theme"),
  ...meta,
});

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  hypothesis: text("hypothesis").notNull(),
  change: text("change").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  result: text("result"),
  decision: text("decision"),
  ...meta,
});

export const stuckEvents = sqliteTable("stuck_events", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  blocker: text("blocker", { enum: ["uncertainty", "fear", "inertia"] }).notNull(),
  unblocker: text("unblocker"),
  at: text("at").notNull(),
  ...meta,
});

export const rechargeItems = sqliteTable("recharge_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind"),
  ...meta,
});

export const storyRefs = sqliteTable("story_refs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  medium: text("medium").notNull(),
  character: text("character"),
  lesson: text("lesson").notNull(),   // paraphrased only
  moment: text("moment").notNull(),
  yourLine: text("your_line"),
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
  lastShownAt: text("last_shown_at"),
  ...meta,
});

export const watchQueue = sqliteTable("watch_queue", {
  title: text("title").primaryKey(),
  totalEpisodes: integer("total_episodes"),
  watched: integer("watched").notNull().default(0),
  unlocked: integer("unlocked").notNull().default(0),
  status: text("status").notNull().default("queued"),
  ...meta,
});

// ===================== v3 =====================
// TODO(v3): notes + FTS5 virtual table created in raw SQL migration.
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type"),
  status: text("status"),
  tags: text("tags"),                 // JSON array
  areaId: text("area_id"),
  goalId: text("goal_id"),
  sourceUrl: text("source_url"),
  bodyJson: text("body_json"),        // BlockNote document
  canExplain: integer("can_explain", { mode: "boolean" }),
  canImplement: integer("can_implement", { mode: "boolean" }),
  misunderstood: text("misunderstood"),
  publishedUrl: text("published_url"),
  ...meta,
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  r2Key: text("r2_key").notNull(),
  noteId: text("note_id"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  ...meta,
});

export const pushSubscriptions = sqliteTable("push_subscriptions", { // v4
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  device: text("device"),
  ...meta,
});

// TODO(v3): applications, stories, japanese_log
