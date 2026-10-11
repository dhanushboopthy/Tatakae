import { Hono } from "hono";
import { syncRequest } from "@tatakae/core";
import type { AppBindings } from "../env";
import { applySync } from "../lib/sync.service";
import { parseBody } from "../lib/validate";

// Phase v1. Batch outbox push + pull changes since cursor.
//   POST / syncRequest { client, cursor, items ≤ 500 } → syncResponse { applied, conflicts, changes, cursor }
export const sync = new Hono<AppBindings>();

sync.post("/", async (c) => {
  const req = await parseBody(c, syncRequest);
  return c.json(applySync(c.get("db"), req));
});
