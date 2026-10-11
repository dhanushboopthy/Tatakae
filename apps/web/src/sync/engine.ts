import type { QueryClient } from "@tanstack/react-query";

/**
 * Flush outbox on: open, visibilitychange→visible, online, after writes (debounce 2s).
 * POST /api/sync, apply server changes into query cache, store cursor.
 * Android: register Background Sync tag "outbox".
 */
export function initSync(qc: QueryClient): void {
  // TODO(v1)
}

/** Optimistic write helper: update cache, enqueue, schedule flush. */
export async function write(table: string, row: Record<string, unknown>): Promise<void> {
  // TODO(v1)
}
