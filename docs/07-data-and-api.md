# 07 · Data model and API

Source of truth: `db/schema.ts`. Conventions: ULID text ids, IST `YYYY-MM-DD` dates, ISO timestamps, `updated_at` on every row (LWW), soft delete via `deleted_at`.

## Tables by phase
| Phase | Table | Key columns |
|---|---|---|
| 0 | sessions | id (hashed), client web/mobile, device_name, expires_at |
| 0 | job_runs | job, started_at, ok, detail |
| v1 | days | date PK, kind normal/rest/write_off, screen_min, small_win, q_p1, q_drift, q_practised, intention, energy, forged_at |
| v1 | missions | id, title, day_date (null = backlog), slot P1/P2/P3/side/backlog, points, status, minimum, if_then, resume_note, goal_id, est_min, actual_min, reschedule_count |
| v1 | habits / habit_logs | anchor, behaviour, minimum, frequency, area_id, active / (habit_id, date) done |
| v1 | anchors | name, start_time, end_time, weekdays |
| v1 | settings | key, value JSON, editable_from |
| v1 | inbox | text, created_at, processed |
| v1 | mura_events | mission_id, reason, at |
| v2 | areas, goals, reviews, experiments, stuck_events, recharge_items, story_refs, watch_queue | see schema |
| v3 | notes (+ notes_fts), files, applications, stories, japanese_log | see schema |
| v4 | push_subscriptions | endpoint, keys (laptop only) |

Phone local DB mirrors the v1 tables + `outbox` + `sync_meta`.

## API (all under `/api`, JSON, Zod-validated)
| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | /health | 0 | public |
| POST | /session/login | 0 | `{email,password,client,deviceName}`; web → cookie, mobile → `{token,expiresAt}` |
| POST | /session/logout, GET /session/me | 0 | |
| GET/DELETE | /session/devices[/:id] | v1 | revoke a device |
| GET | /app/version | v4 | public; `{minMobileVersion, latestApkUrl}` |
| GET/PUT | /days/:date | v1 | GET includes missions + score |
| POST | /days/:date/forge | v1 | validates P1 Minimum + if-then |
| CRUD | /missions | v1 | 423 when day forged |
| POST | /missions/:id/edit-locked | v1 | `{reason, patch}` → mura_events |
| CRUD | /habits, PUT /habits/:id/logs/:date | v1 | |
| CRUD | /inbox | v1 | |
| GET/PUT | /settings[/:key] | v1 | scoring keys only on even-week Sundays |
| POST | /sync | v1 | see below |
| GET | /stats/week/:isoWeek, /stats/month/:yyyymm | v2 | |
| CRUD | /goals, /areas, /reviews, /experiments, /stuck, /story | v2 | `/story/next?moment=` |
| CRUD | /notes, GET /notes/search?q= | v3 | FTS5 |
| POST | /files | v3 | multipart |
| GET | /export | v4 | full JSON |
| POST | /push/subscribe | v4 | laptop web push |

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
