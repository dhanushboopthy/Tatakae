# Mockups (sample data)

Static HTML mockups of the "Soft Bento" direction, made 11 Oct 2026. Live canvas: https://claude.ai/artifact/6adCof169njJ7zxUvMSjRB

| File | Screen |
|---|---|
| Phone-Today.dc.html | Phone Today: week strip, count chips, P1 hero, P2/P3 cards, 2 scoreboard boxes, floating pill nav |
| Phone-Calendar.dc.html | Phone Calendar: month DayCircles, legend, 4 scoreboard boxes |
| Phone-Week.dc.html | Phone Week: hatched stacked bars, stripe screen-minutes trend, focus-by-area bar |
| Main.dc.html | Laptop dashboard: icon rail, bento grid, P1 hero, metric cards, stripe trend, week bars, 12-segment cycle gauge, goal rings |
| Web-Calendar.dc.html | Laptop week planner: time rail, area blocks, internship anchor, planned (dashed) vs done, current-time line |

These are layout and style references (inline styles, inline SVG icons). The real components use the tokens in `apps/web/tailwind.config.js` / `apps/mobile/src/theme.ts`, Lucide icons via `packages/core/src/icons.ts`, and data from `/stats/*`.
