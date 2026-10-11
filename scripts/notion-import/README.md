# Notion import (one-off)

1. In Notion: TATAKAE → ••• → Export → Markdown & CSV, include subpages → unzip into `export/` (git-ignored).
2. `python3 main.py --export ./export --out ./import.json`
3. Review `import.json`, then `python3 main.py --push import.json --api https://<pages-domain>/api` (uses `Authorization: Bearer $API_TOKEN`).

Mapping (v2 import #1): Tasks & Sprints → missions (backlog if no date), Habits → habits, Areas → areas, Projects → goals, Today day cards → days.
Mapping (v3 import #2): Second Brain → notes (markdown → BlockNote JSON).
Old scoring columns are ignored; scores are recomputed by core.
