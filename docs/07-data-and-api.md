# 07 · Data model and API

Source of truth: `db/schema.ts`. Conventions: ULID text ids, IST `YYYY-MM-DD` dates, ISO timestamps, `updated_at` on every row (LWW), soft delete via `deleted_at`.

## Tables by phase
| Phase | Table | Key columns |
|---|---|---|
| 0 | sessions | id (hashed), client web/mobile, device_name, expires_at |
| 0 | job_runs | job, started_at, ok, detail |
| v1 | days | date PK, kind normal/rest/write_off, screen_min, small_win, q_p1, q_drift, q_practised, intention, energy, forged_at |
| v1 | missions | id, title, day_date (null = backlog), slot P1…P9/side/backlog, points, status, minimum, if_then, resume_note, goal_id, est_min, actual_min, reschedule_count |
| v1 | habits / habit_logs | anchor, behaviour, minimum, frequency, area_id, active / (habit_id, date) done |
| v1 | anchors | name, start_time, end_time, weekdays |
| v1 | settings | key, value JSON, editable_from |
| v1 | inbox | text, created_at, processed |
| v1 | mura_events | mission_id, reason, at |
| v1 | focus_sessions | mission_id, area_id, started_at, ended_at, planned_min, completed |
| v2 | areas, goals, reviews, experiments, stuck_events, recharge_items, story_refs, watch_queue | see schema |
| v3 | notes (+ notes_fts), files, applications, stories, japanese_log | see schema |
| v4 | push_subscriptions | endpoint, keys (laptop only) |
| Fitness | body_logs | date PK (sync key), id, weight_kg, steps, water_ml, sleep_min, note |
| Fitness | foods / food_logs | name, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, fibre_g, micros JSON, favourite / date, meal, food_id, name, servings + nutrient snapshot per serving |
| Fitness | fitness_phases | kind cut/bulk/recomp, start_date, end_date, rate_pct_per_week, protein_g_per_kg, fat_g_per_kg, start_weight_kg |
| Fitness | workouts / workout_sets | date, name, duration_min / workout_id, exercise, muscle, sort_order, reps, kg, rpe |
| Fitness | maintenance_weeks | iso_week PK (sync key, "2026-W42"), id, kcal, note |

Phone local DB mirrors the v1 tables + `outbox` + `sync_meta`.

## API (all under `/api`, JSON, Zod-validated)
| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | /health | 0 | public |
| POST | /session/login | 0 | `{email,password,client,deviceName}`; web → cookie, mobile → `{token,expiresAt}` |
| POST | /session/logout, GET /session/me | 0 | |
| GET/DELETE | /session/devices[/:id] | v1 | revoke a device |
| POST | /passkeys/login/options, /passkeys/login | v4 | public, 20/15 min per IP; `{response, deviceName}` → web cookie |
| GET/POST | /passkeys, /passkeys/register/options | v4 | list; register `{response, name}` (auth) |
| PATCH/DELETE | /passkeys/:id | v4 | rename `{name}` / remove (auth); the password keeps working |
| GET | /app/version | v4 | public; `{minMobileVersion, latestApkUrl}` |
| GET/PUT | /days/:date | v1 | GET includes missions + score |
| POST | /days/:date/forge | v1 | validates P1 Minimum + if-then |
| POST | /days/:date/restart | v1 | `{reason ≥ 20, confirm: "restart"}` unlocks a forged plan; once per date, 2 per 7 days; mura event |
| CRUD | /missions | v1 | 423 when day forged |
| POST | /missions/:id/edit-locked | v1 | `{reason, patch}` → mura_events |
| CRUD | /habits, PUT /habits/:id/logs/:date | v1 | |
| CRUD | /inbox | v1 | |
| GET/PUT | /settings[/:key] | v1 | scoring keys only on even-week Sundays |
| POST | /sync | v1 | see below |
| GET | /stats/scoreboard, /stats/calendar/:yyyymm, /stats/series, /stats/week/:isoWeek | v1 | see docs/11 §5 |
| GET | /stats/month/:yyyymm, /stats/cycle, /stats/habits | v2 | |
| CRUD | /focus | v1 | focus sessions |
| CRUD | /goals, /areas, /reviews, /experiments, /stuck, /story | v2 | `/story/next?moment=` |
| CRUD | /notes, GET /notes/search?q= | v3 | FTS5 over `notes.body_text` (plain text of the BlockNote body) |
| POST, GET, DELETE | /files[/:id] | v3 | multipart ≤ 20 MB → FILES_DIR (+ Object Storage copy) |
| CRUD | /applications, /stories, /japanese | v3 | REST only (not synced); `/japanese?from=&to=` |
| GET | /export | v4 | full JSON |
| GET | /system/jobs | v4 | `job_runs`, newest first |
| GET | /push/key, POST /push/test | v4 | 503 `push_off` without VAPID keys |
| POST/DELETE | /push/subscribe | v4 | laptop web push (06:30 morning message only) |

## Sync protocol
Request `POST /api/sync`
```json
{ "client": "mobile", "cursor": "01J…", "items": [
  { "id": "01J…", "table": "missions", "op": "upsert", "row": { "id": "…", "status": "done", "updatedAt": "2026-10-20T08:12:00Z" }, "updatedAt": "2026-10-20T08:12:00Z" } ] }
```
Response
```json
{ "applied": ["01J…"], "conflicts": [{ "id": "…", "server": { } }], "changes": [{ "table": "days", "row": { } }], "cursor": "01J…" }
```
Rules: LWW by `updatedAt`; server-authoritative for `days.forged_at` and missions on a forged day (unless via `edit-locked`); max 500 items per request; idempotent by item `id`; cursor = last server change id.
