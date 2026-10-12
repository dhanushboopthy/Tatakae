import { reviewInput, reviewPatch } from "@tatakae/core";
import { crudRoutes, liveRows } from "../lib/crud";
import { Conflict } from "../lib/errors";
import { unlockReward } from "../lib/story.service";

// Phase v2. Weekly Control Room (Muri → Mura → Muda), monthly, cycle reviews. One review per type and
// period. Creating a weekly review unlocks one episode in the reward queue (docs/02).
//   GET / · GET /:id · POST / · PATCH /:id · DELETE /:id  (see lib/crud.ts)
export const reviews = crudRoutes({
  table: "reviews",
  input: reviewInput,
  patch: reviewPatch,
  label: "review",
  sort: (a, b) => b.periodStart.localeCompare(a.periodStart) || a.type.localeCompare(b.type),
  guard: (db, next, prev) => {
    if (prev) return;
    const dup = liveRows(db, "reviews").find((r) => r.type === next.type && r.periodStart === next.periodStart && r.id !== next.id);
    if (dup) throw new Conflict("That period already has a review. Edit it instead.", "review_exists", { id: dup.id });
    if (next.type === "week") unlockReward(db);
  },
});
