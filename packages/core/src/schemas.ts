import { z } from "zod";

// Zod schemas for every API input/output. TODO(v1): complete + export inferred types.

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dayKind = z.enum(["normal", "rest", "write_off"]);
export const slot = z.enum(["P1", "P2", "P3", "side", "backlog"]);
export const missionStatus = z.enum(["open", "done", "minimum", "missed", "rescheduled", "backlog"]);

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
// TODO(v1): refine — slot P1 requires minimum + ifThen.

export const missionPatch = missionInput.partial().extend({
  status: missionStatus.optional(),
  resumeNote: z.string().max(500).nullable().optional(),
  actualMin: z.number().int().nonnegative().nullable().optional(),
});

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

export const inboxInput = z.object({ text: z.string().min(1).max(1000) });

export const stuckInput = z.object({
  missionId: z.string(),
  blocker: z.enum(["uncertainty", "fear", "inertia"]),
  unblocker: z.string().max(300).nullable(),
});

export const outboxItem = z.object({
  id: z.string(),
  table: z.string(),
  op: z.enum(["upsert", "delete"]),
  row: z.record(z.unknown()),
  updatedAt: z.string(),
});

export const clientKind = z.enum(["web", "mobile"]);

export const syncRequest = z.object({
  client: clientKind,
  cursor: z.string().nullable(),
  items: z.array(outboxItem).max(500),
});

export const syncResponse = z.object({
  applied: z.array(z.string()),
  conflicts: z.array(z.object({ id: z.string(), server: z.record(z.unknown()) })),
  changes: z.array(z.object({ table: z.string(), row: z.record(z.unknown()) })),
  cursor: z.string(),
});

// TODO(v2): goal, area, review, experiment, storyRef, watchQueue schemas.
// TODO(v3): note, file schemas.

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  client: clientKind,
  deviceName: z.string().min(1).max(40), // "laptop-1", "laptop-2", "phone"
});
export const loginMobileResponse = z.object({ token: z.string(), expiresAt: z.string() });

export type OutboxItem = z.infer<typeof outboxItem>;
export type SyncRequest = z.infer<typeof syncRequest>;
export type SyncResponse = z.infer<typeof syncResponse>;
export type ClientKind = z.infer<typeof clientKind>;
