import type { Db } from "./db";
import type { z } from "zod";
import type { syncRequest, syncResponse } from "@tatakae/core";

/** Apply outbox items with LWW by updated_at; server wins on forged_at / locked missions. */
export async function applySync(db: Db, req: z.infer<typeof syncRequest>): Promise<z.infer<typeof syncResponse>> {
  // TODO(v1)
  throw new Error("not implemented");
}
