import type { Env } from "../env";
import type { Db } from "../lib/db";

let warned = false;

/**
 * Only relevant if the tenancy stays on the free (non-PAYG) plan. Oracle may reclaim an
 * Always Free instance when, over 7 days, CPU p95 < 20%, network < 20% and (A1) memory < 20%.
 *
 * Decision: this stays a no-op. Burning CPU/memory on purpose wastes the box and still might not
 * meet the thresholds; the real answer is upgrading the account to Pay-As-You-Go (Always Free
 * shapes stay free there and are not reclaimed). See docs/08-operations.md and MANUAL-STEPS.md.
 * KEEP_WARM=1 only logs a reminder once.
 */
export async function runKeepWarm(env: Env, _db: Db): Promise<void> {
  if (env.KEEP_WARM !== "1" || warned) return;
  warned = true;
  console.log("[keepWarm] KEEP_WARM=1 is set, but keep-warm is intentionally a no-op. Upgrade the OCI account to Pay-As-You-Go to avoid idle reclaim.");
}
