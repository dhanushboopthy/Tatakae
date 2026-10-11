import type { OutboxItem } from "@tatakae/core";

/** Outbox rows live in local SQLite table `outbox`. Same shape as the web client. */
export async function enqueue(item: OutboxItem): Promise<void> {
  // TODO(v1)
}

export async function drain(limit = 500): Promise<OutboxItem[]> {
  // TODO(v1)
  return [];
}
