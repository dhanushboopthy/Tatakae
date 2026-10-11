import type { ISOTime } from "./types";

// Pure sync helpers shared by web, mobile and api. No I/O.

/** Last-write-wins per row by updated_at; ties → server wins. */
export function mergeLww<T extends { updatedAt: ISOTime }>(local: T, remote: T): T {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Server is authoritative for plan lock: days.forged_at and missions on a forged day. */
export function isServerAuthoritative(table: string, row: Record<string, unknown>): boolean {
  // TODO(v1)
  throw new Error("not implemented");
}
