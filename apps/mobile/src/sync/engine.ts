import type { QueryClient } from "@tanstack/react-query";

/**
 * Flush outbox: on AppState → active, on NetInfo reconnect, after writes (2 s debounce).
 * Android: register expo-background-task for an opportunistic flush (not guaranteed timing).
 * POST /api/sync { client: "mobile", cursor, items } → apply changes into local DB + query cache.
 */
export function initSync(qc: QueryClient): () => void {
  // TODO(v1): return unsubscribe
  return () => {};
}

export async function write(table: string, row: Record<string, unknown>): Promise<void> {
  // TODO(v1): optimistic local write + enqueue + schedule flush
}
