import type { Env } from "../env";
import type { Db } from "../lib/db";

/**
 * Only needed if the tenancy stays on the free (non-PAYG) plan. Oracle may reclaim an
 * Always Free instance when, over 7 days, CPU p95 < 20%, network < 20% and (A1) memory < 20%.
 * Preferred fix is upgrading the account to Pay-As-You-Go (see docs/08-operations.md).
 * Do NOT burn CPU here by default — this is a no-op unless KEEP_WARM=1 is set.
 */
export async function runKeepWarm(env: Env, db: Db): Promise<void> {
  // TODO(phase0): decide; default no-op
}
