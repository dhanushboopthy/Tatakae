# Story reference pack

The app ships **without** any franchise content. Your personal pack lives in `*.local.json` (git-ignored) and is imported via Settings → Story. Pictures for each title live in `pictures/` (git-ignored) and are added in Settings → Story → Pictures, which uploads them to your own server.

Rules for every entry:
- `lesson` is one short line, max 160 characters: your own paraphrase, or a short line of dialogue (owner's decision, 12 Oct 2026). Keep the file private; never commit it.
- `character` is who said or did it (optional); `yourLine` ties it to the method (optional, ≤ 160).
- `moment` is one of: p1_done, minimum_done, comeback, stuck_fear, stuck_inertia, weekly_review, cycle_start, rest_day.
- Pictures: one per title, PNG/JPEG/WebP/GIF ≤ 5 MB, file name = the title. No audio.

Disclaimer shown in the app:
> Titles, character names and pictures belong to their respective owners. Used privately for personal motivation; no affiliation or endorsement.
