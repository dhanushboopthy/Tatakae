// Shared domain types. Keep in sync with db/schema.ts and schemas.ts.

export type ISODate = string; // YYYY-MM-DD in Asia/Kolkata
export type ISOTime = string; // full ISO timestamp

export type DayKind = "normal" | "rest" | "write_off";
export type Slot = "P1" | "P2" | "P3" | "side" | "backlog";
export type MissionStatus =
  | "open" | "done" | "minimum" | "missed" | "rescheduled" | "backlog";
export type Mark = "Strong" | "Solid" | "Light" | "Unplanned";
export type Blocker = "uncertainty" | "fear" | "inertia";
export type ReviewType = "week" | "month" | "cycle";
export type FocusLength = 25 | 50 | 90;

export interface Day {
  date: ISODate;
  kind: DayKind;
  screenMin: number | null;
  smallWin: string | null;
  qP1: string | null;       // Did I do P1?
  qDrift: string | null;    // What made me drift?
  qPractised: string | null;// What did I practise?
  intention: string | null; // morning question
  energy: 1 | 2 | 3 | 4 | 5 | null;
  forgedAt: ISOTime | null; // plan lock
  updatedAt: ISOTime;
}

export interface Mission {
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
  rescheduleCount: number;
  updatedAt: ISOTime;
}

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

export interface StoryRef {
  id: string;
  title: string;
  medium: "anime" | "film" | "series" | "kdrama" | "book";
  character: string | null;
  lesson: string;          // paraphrased, never a verbatim quote
  moment: StoryMoment;
  yourLine: string | null;
  muted: boolean;
}

export type StoryMoment =
  | "p1_done" | "minimum_done" | "comeback" | "stuck_fear"
  | "stuck_inertia" | "weekly_review" | "cycle_start" | "rest_day";
