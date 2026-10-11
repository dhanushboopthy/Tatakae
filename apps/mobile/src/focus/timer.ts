import type { FocusLength } from "@tatakae/core";

export interface FocusSession {
  missionId: string;
  length: FocusLength;
  startedAt: number; // epoch ms — derive remaining time, never count ticks
  pausedMs: number;
}

export function remainingMs(s: FocusSession, now = Date.now()): number {
  // TODO(v1)
  return 0;
}
// TODO(v2): Android ongoing notification with remaining time
