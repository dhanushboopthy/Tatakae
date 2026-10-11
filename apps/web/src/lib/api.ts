/** Thin fetch wrapper for /api. Reads go to network then cache; writes go through sync/outbox. */
export async function apiGet<T>(path: string): Promise<T> {
  // TODO(phase0): on 401 → navigate to /login (keep outbox intact)
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}
