// Shared domain types. Keep in sync with db/schema.ts (Drizzle property names) and the row
// schemas in schemas.ts — those use `satisfies` against these interfaces so drift fails typecheck.

export type ISODate = string; // YYYY-MM-DD in Asia/Kolkata
export type ISOTime = string; // full ISO timestamp

export type DayKind = "normal" | "rest" | "write_off";
/** Ranked missions P1…P9 (5 shown by default, up to 9 a day), one unscored side quest, or the backlog. */
export type RankedSlot = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9";
export type Slot = RankedSlot | "side" | "backlog";
export type MissionStatus =
  | "open" | "done" | "minimum" | "missed" | "rescheduled" | "backlog";
export type Mark = "Strong" | "Solid" | "Light" | "Unplanned";
export type Blocker = "uncertainty" | "fear" | "inertia";
export type ReviewType = "week" | "month" | "cycle";
/** Whole minutes, FOCUS_MIN (5) to FOCUS_MAX (240); validated by the `focusLength` schema. */
export type FocusLength = number;
export type StoryMedium = "anime" | "film" | "series" | "kdrama" | "book";
export type GoalStatus = "active" | "paused" | "done" | "dropped";
export type WatchStatus = "queued" | "watching" | "done" | "dropped";

/** Columns every synced row carries: LWW timestamp + soft delete. */
export interface RowMeta {
  updatedAt: ISOTime;
  deletedAt: ISOTime | null;
}

// ===================== v1 =====================
export interface Day extends RowMeta {
  date: ISODate;
  kind: DayKind;
  screenMin: number | null;
  smallWin: string | null;
  qP1: string | null;       // Did I do P1?
  qDrift: string | null;    // What made me drift?
  qPractised: string | null;// What did I practise?
  intention: string | null; // morning question
  energy: number | null;    // 1..5
  forgedAt: ISOTime | null; // plan lock (server-authoritative)
}

export interface Mission extends RowMeta {
  id: string;
  title: string;
  dayDate: ISODate | null; // null = backlog
  slot: Slot;
  points: number | null;   // blank = 1
  status: MissionStatus;
  minimum: string | null;  // required for P1
  ifThen: string | null;   // required for P1
  resumeNote: string | null;
  goalId: string | null;
  estMin: number | null;
  actualMin: number | null;
  plannedStart?: string | null; // HH:MM, v2 week planner
  rescheduleCount: number;
}

export interface Habit extends RowMeta {
  id: string;
  anchor: string | null;   // "After I ..."
  behaviour: string;
  minimum: string | null;
  frequency: string;       // "daily" | "weekdays" | free text
  areaId: string | null;
  active: boolean;
}

export interface HabitLog extends RowMeta {
  habitId: string;
  date: ISODate;
  done: boolean;
}

export interface Anchor extends RowMeta {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  weekdays: string;  // "1,2,3,4,5" (0 = Sun … 6 = Sat)
}

export interface SettingRow extends RowMeta {
  key: string;
  value: string;               // JSON-encoded value, see settingValueSchemas
  editableFrom: string | null; // "even_sunday" → only on even-ISO-week Sundays
}

export interface InboxItem extends RowMeta {
  id: string;
  text: string;
  createdAt: ISOTime;
  processed: boolean;
}

export interface MuraEvent extends RowMeta {
  id: string;
  missionId: string;
  reason: string;
  at: ISOTime;
}

/** One focus block (Focus screen). endedAt null = still running. Minutes count from startedAt → endedAt. */
export interface FocusSession extends RowMeta {
  id: string;
  missionId: string | null;
  areaId: string | null;
  startedAt: ISOTime;
  endedAt: ISOTime | null;
  plannedMin: number;
  completed: boolean;
}

// ===================== v2 =====================
export interface StuckEvent extends RowMeta {
  id: string;
  missionId: string;
  blocker: Blocker;
  unblocker: string | null;
  at: ISOTime;
}

export interface RechargeItem extends RowMeta {
  id: string;
  name: string;
  kind: string | null;
}

export interface Area extends RowMeta {
  id: string;
  name: string;
  standard: string | null;
  why: string | null;
  alignmentScore: number | null;
  color?: string | null; // sage | rose | butter | sky | lime-soft | lavender-soft
  icon?: string | null;  // lucide name, see icons.ts
}

export interface Goal extends RowMeta {
  id: string;
  name: string;
  areaId: string | null;
  status: GoalStatus;
  intent: string | null;
  outcome: string | null;
  niceGoal: string | null;
  nextAction: string | null;
  why: string | null;
  hellYeah: boolean;
  targetPoints?: number | null; // ring progress
  start: ISODate | null;
  end: ISODate | null;
}

export interface Review extends RowMeta {
  id: string;
  type: ReviewType;
  periodStart: ISODate;
  periodEnd: ISODate;
  wins: string | null;
  failed: string | null;
  why: string | null;
  muri: string | null;
  mura: string | null;
  muda: string | null;
  diagnosis: string | null;
  bottleneck: string | null;
  capacity: number | null;
  burnout: number | null;
  capability: number | null;
  theme: string | null;
}

export interface Experiment extends RowMeta {
  id: string;
  hypothesis: string;
  change: string;
  start: ISODate;
  end: ISODate;
  result: string | null;
  decision: string | null;
}

export interface StoryRef extends RowMeta {
  id: string;
  title: string;
  medium: StoryMedium;
  character: string | null;
  lesson: string;          // paraphrased, never a verbatim quote (≤ 160 chars)
  moment: StoryMoment;
  yourLine: string | null;
  muted: boolean;
  lastShownAt: ISOTime | null;
}

export interface WatchQueueItem extends RowMeta {
  title: string;
  totalEpisodes: number | null;
  watched: number;
  unlocked: number;
  status: WatchStatus;
}

export type StoryMoment =
  | "p1_done" | "minimum_done" | "comeback" | "stuck_fear"
  | "stuck_inertia" | "weekly_review" | "cycle_start" | "rest_day";

// ===================== v3 (REST only, not synced) =====================
export type ApplicationStatus = "wishlist" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";
export type JapaneseKind = "anki" | "reading" | "listening" | "speaking" | "writing";

/** Second-brain note. `bodyJson` is a BlockNote document (array of blocks). */
export interface Note extends RowMeta {
  id: string;
  title: string;
  type: string | null;
  status: string | null;
  tags: string[];
  areaId: string | null;
  goalId: string | null;
  sourceUrl: string | null;
  bodyJson: unknown[] | null;
  canExplain: boolean | null;
  canImplement: boolean | null;
  misunderstood: string | null;
  publishedUrl: string | null;
}

/** Note list entry: everything but the body, plus a plain-text excerpt. */
export type NoteSummary = Omit<Note, "bodyJson"> & { excerpt: string };

export interface NoteSearchHit {
  id: string;
  title: string;
  snippet: string;
  updatedAt: ISOTime;
}

/** Uploaded file (FILES_DIR on the VM, optional Object Storage copy). Served at `/api/files/:id`. */
export interface FileMeta extends RowMeta {
  id: string;
  name: string;
  noteId: string | null;
  mime: string;
  size: number;
}

export interface Application extends RowMeta {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedOn: ISODate | null;
  url: string | null;
  source: string | null;
  nextStep: string | null;
  nextStepOn: ISODate | null;
  notes: string | null;
}

/** Interview story in STAR form (table `stories`). */
export interface InterviewStory extends RowMeta {
  id: string;
  title: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  tags: string[];
  goalId: string | null;
}

export interface JapaneseLogEntry extends RowMeta {
  id: string;
  date: ISODate;
  minutes: number;
  kind: JapaneseKind;
  note: string | null;
}

// ===================== Fitness (docs/plans/fitness.md) =====================
// Synced. body_logs is keyed by `date` and maintenance_weeks by `isoWeek` (SYNC_TABLE_PK); `id` is kept on both.
export type MicroKey =
  | "fibre" | "sugar" | "satFat" | "sodium" | "potassium" | "calcium" | "iron" | "magnesium"
  | "zinc" | "vitA" | "vitB12" | "vitC" | "vitD";
/** Micronutrient amounts by key, in the units of MICRO_KEYS. Missing key = not entered. */
export type Micros = Partial<Record<MicroKey, number>>;
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type PhaseKind = "cut" | "bulk" | "recomp";

export interface BodyLog extends RowMeta {
  id: string;
  date: ISODate; // unique
  weightKg: number | null;
  steps: number | null;
  waterMl: number | null;
  sleepMin: number | null;
  note: string | null;
}

export interface Food extends RowMeta {
  id: string;
  name: string;
  servingLabel: string;
  servingG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number | null;
  micros: Micros;
  favourite: boolean;
}

/** One logged food. Nutrients are a snapshot per serving, so editing a food never rewrites history. */
export interface FoodLog extends RowMeta {
  id: string;
  date: ISODate;
  meal: MealSlot;
  foodId: string | null;
  name: string;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number | null;
  micros: Micros;
}

export interface FitnessPhase extends RowMeta {
  id: string;
  kind: PhaseKind;
  startDate: ISODate;
  endDate: ISODate | null;
  ratePctPerWeek: number; // signed: cut < 0, bulk > 0, recomp 0
  proteinGPerKg: number;
  fatGPerKg: number;
  startWeightKg: number;
  note: string | null;
}

export interface Workout extends RowMeta {
  id: string;
  date: ISODate;
  name: string;
  durationMin: number | null;
  note: string | null;
}

export interface WorkoutSet extends RowMeta {
  id: string;
  workoutId: string;
  exercise: string;
  muscle: string;
  order: number;
  reps: number;
  kg: number;
  rpe: number | null;
}

export interface MaintenanceWeek extends RowMeta {
  id: string;
  isoWeek: string; // "2026-W42", unique
  kcal: number;
  note: string | null;
}

/** Row type for each synced table (keys = SQL table names, see SYNC_TABLES in sync.ts). */
export interface SyncRowMap {
  days: Day;
  missions: Mission;
  habits: Habit;
  habit_logs: HabitLog;
  anchors: Anchor;
  settings: SettingRow;
  inbox: InboxItem;
  mura_events: MuraEvent;
  focus_sessions: FocusSession;
  stuck_events: StuckEvent;
  recharge_items: RechargeItem;
  areas: Area;
  goals: Goal;
  reviews: Review;
  experiments: Experiment;
  story_refs: StoryRef;
  watch_queue: WatchQueueItem;
  body_logs: BodyLog;
  foods: Food;
  food_logs: FoodLog;
  fitness_phases: FitnessPhase;
  workouts: Workout;
  workout_sets: WorkoutSet;
  maintenance_weeks: MaintenanceWeek;
}

// ===================== scoring =====================
export interface ScoringSettings {
  screenFreeMin: number;      // 120
  screenStepMin: number;      // 30
  screenStepPenalty: number;  // 5
  screenPenaltyCap: number;   // 20
  comebackBonus: number;      // 10
  strongAt: number;           // 80
  solidAt: number;            // 50
  missedExecBelow: number;    // 25
  capacityRatio: number;      // 0.8
  writeOffsPerMonth: number;  // 2
}

export interface DayScore {
  excluded: boolean;
  planned: number;
  earned: number;
  exec: number;
  penalty: number;
  bonus: number;
  final: number;
  mark: Mark;
  missedDay: boolean;
}
