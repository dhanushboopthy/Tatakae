import { Hono } from "hono";
import { settingPut } from "@tatakae/core";
import type { AppBindings } from "../env";
import { getSettings, putSetting } from "../lib/settings.service";
import { idParam, parseBody } from "../lib/validate";

// Phase v1. Scoring constants editable only on even-week Sundays.
//   GET /       → { scoring: {...}, wake_time, ritual_time, focus_default, story_enabled, haptics_enabled, afternoon_nudge }
//   PUT /:key   { value } → { key, value }   (404 unknown key, 400 invalid, 423 scoring_locked)
export const settings = new Hono<AppBindings>();

settings.get("/", (c) => c.json(getSettings(c.get("db"))));

settings.put("/:key", async (c) => {
  const body = await parseBody(c, settingPut);
  return c.json(putSetting(c.get("db"), idParam(c, "key"), body.value));
});
