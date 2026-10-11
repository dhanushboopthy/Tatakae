# 10 · Design system — "Night forge"

One calm dark direction for both clients. It keeps the shared tokens from `05-ui-ux.md` as hard constraints and adds
surfaces, type, spacing, motion and chart rules around them. Web implementation: `apps/web/tailwind.config.js` +
`apps/web/src/index.css`. Mobile mirrors the values in `apps/mobile/src/theme.ts` (see *Mobile sync* below).

## Direction
- **Quiet surfaces, one warm accent.** Near-black ink layers, soft paper text, ember only for the one primary action on
  a screen. Jade means "done", grey means "not this time". Nothing glows, nothing pulses.
- **Elevation by surface, not shadow.** Each layer is a step lighter (ink → ink-2 → ink-3) with a hairline border.
  Only overlays (dialogs, palette, toasts) get a shadow, so they read as "in front".
- **Numbers are calm.** Tabular figures everywhere a number can change (timers, counts, scores) so nothing jitters.
- **Grey, never red.** Red-ish `danger` exists only on the confirm step of destructive actions (logout, revoke, discard).

## Colour tokens
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0b0b0f` | App background (dark grey, not pure black) |
| `ink-2` | `#14141a` | Cards, sidebar, panels |
| `ink-3` | `#1c1c24` | Inputs, raised rows, hovered items, dialog body |
| `line` | `#2a2a33` | Hairline dividers and card edges (decorative only) |
| `line-strong` | `#6a6a76` | Boundaries that identify a control (inputs, chip outlines, hollow marks) |
| `paper` | `#ececf1` | Primary text |
| `muted` | `#8a8a96` | Secondary text, missed/grey states, chart grey |
| `ember` | `#f2a33a` | Primary action, focus ring, P1 accent, capacity fill |
| `ember-soft` | `#2e2215` | Ember-tinted background (selected chip, P1 card wash) |
| `jade` | `#4fbf8f` | Done, success marks |
| `jade-soft` | `#152622` | Jade-tinted background (done chip) |
| `danger` | `#d9776f` | Confirm step of destructive actions only (muted red) |
| `ritual` / `ritual-2` | `#120f0c` / `#1a1612` | Optional warmer, dimmer surfaces for the night ritual |

No `muted-text` variant is needed: `muted` passes 4.5:1 as text on every surface (see below), so it is used both for
secondary text and for grey marks.

## Contrast (WCAG 2.x relative luminance, computed)
Computed with the WCAG formula `(L1 + 0.05) / (L2 + 0.05)` from sRGB hex values. Text needs 4.5:1 (AA, normal size);
UI components, focus indicators and chart marks need 3:1.

### Text on surfaces
| Foreground ↓ / Background → | ink | ink-2 | ink-3 | ritual | ritual-2 | Verdict |
|---|---|---|---|---|---|---|
| paper `#ececf1` | 16.68 | 15.58 | 14.37 | 16.22 | 15.28 | AAA everywhere |
| muted `#8a8a96` | 5.76 | 5.38 | 4.96 | 5.60 | 5.27 | AA text everywhere (lowest: 4.96 on ink-3) |
| ember `#f2a33a` | 9.43 | 8.80 | 8.12 | 9.16 | 8.63 | AAA |
| jade `#4fbf8f` | 8.59 | 8.02 | 7.40 | 8.35 | 7.86 | AAA |
| danger `#d9776f` | 6.38 | 5.96 | 5.49 | 6.20 | 5.84 | AA |

### Text on filled controls
| Pair | Ratio | Verdict |
|---|---|---|
| ink on ember (primary button label) | 9.43 | AAA |
| ink on jade (done fill label) | 8.59 | AAA |
| ink on danger (confirm destructive) | 6.38 | AA |
| ink on muted (filled grey chip) | 5.76 | AA |
| ember on ember-soft | 7.43 | AAA |
| jade on jade-soft | 6.89 | AA |
| paper on ember-soft | 13.15 | AAA |
| paper on jade-soft | 13.39 | AAA |

### UI boundaries, focus ring, marks (need 3:1)
| Pair | Ratio | Verdict |
|---|---|---|
| line-strong vs ink / ink-2 / ink-3 | 3.68 / 3.44 / 3.17 | Pass — use for control boundaries |
| line-strong vs ritual-2 | 3.37 | Pass |
| line vs ink / ink-2 | 1.38 / 1.29 | **Decorative only** — never the only cue for a control |
| ember focus ring vs ink / ink-2 / ink-3 | 9.43 / 8.80 / 8.12 | Pass |
| muted mark (missed, chart grey) vs ink / ink-2 / ink-3 | 5.76 / 5.38 / 4.96 | Pass |
| jade mark vs ink / ink-2 | 8.59 / 8.02 | Pass |
| ember mark vs ink-2 | 8.80 | Pass |
| ember at 50 % over ink (`#7f5725`) | 3.08 | Barely passes — avoid for marks |
| jade at 50 % over ink (`#2d654f`) | 2.89 | **Fails** — never encode "minimum" with half-opacity jade |
| ember vs muted / jade vs muted (adjacent marks) | 1.64 / 1.49 | Colours alone can't separate states → shape encoding below |

Re-run the numbers after any token change:
```bash
node -e 'const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const[a,b]=process.argv.slice(1);const x=L(a),y=L(b);console.log(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2))' "#8a8a96" "#0b0b0f"
```

## Status encoding (never colour alone)
| State | Mark | Colour | Label |
|---|---|---|---|
| Done | filled circle + check | jade | "Done" |
| Minimum | circle outline + left half filled | jade outline and half | "Minimum" |
| Missed / not this time | dash | muted | "Missed" |
| Rescheduled | curved arrow | muted | "Rescheduled" |
| Open | empty circle outline | line-strong | "Open" |
| Rest / write-off day | hollow ring (dashed for write-off) | line-strong | "Rest" / "Written off" |

Chips always show icon + text label, and the selected chip also has `aria-pressed="true"` plus a 1 px line-strong →
paper border change, so selection survives greyscale.

## Typography
- Stack: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
  No web font is downloaded (CSP is `font-src 'self'`; Inter is used when installed, otherwise the system face).
- `font-variant-numeric: tabular-nums` on timers, counts, scores, minutes (`.tnum`).
- Body 16 px / 1.5. Never below 14 px (small labels only, still ≥ 4.5:1).

| Role | Size / line | Weight |
|---|---|---|
| P1 title | 30 px / 36 px (28–32 band) | 600, tracking −0.01em |
| Page title (h1) | 24 px / 32 px | 600 |
| Section (h2) | 18 px / 28 px | 600 |
| Body | 16 px / 24 px | 400 |
| Small / meta | 14 px / 20 px | 400–500 |
| Timer | 72 px / 1 | 600, tabular |

## Spacing, size, radius
- 8-pt grid: 4 (hairline gaps only), 8, 16, 24, 32, 48, 64. Tailwind steps 1, 2, 4, 6, 8, 12, 16.
- Targets: every interactive element ≥ 44 × 44 px (`min-h-tap`, `min-w-tap`).
- Content width: 720 px for reading screens (Today, Ritual), 960 px for Settings.
- Radius: 8 px controls (`rounded-control`), 12 px cards and dialogs (`rounded-card`), full for chips and dots.

## Elevation
| Level | Surface | Border | Shadow |
|---|---|---|---|
| 0 page | ink | — | — |
| 1 card / sidebar | ink-2 | line | — |
| 2 input / raised row | ink-3 | line-strong (inputs) or line | — |
| 3 overlay (dialog, palette, toast) | ink-2 | line | `0 12px 32px rgb(0 0 0 / 0.55)` + backdrop `rgb(0 0 0 / 0.6)` |

## Motion
- 120 ms (hover, press), 160 ms (chips, toggles), 200 ms (dialogs, toasts). Easing `cubic-bezier(0.2, 0, 0, 1)` (ease-out).
- Only opacity and transform. No confetti, no bounce, no looping animation.
- `prefers-reduced-motion: reduce` turns all transitions and animations off (global rule in `index.css`).
- Press-and-hold (Shutdown) shows progress as a filling bar; with reduced motion the fill still tracks the hold time
  (it is state, not decoration) and the typed "done" path is always available.

## Focus
- `:focus-visible` → 2 px ember outline, 2 px offset (8.12–9.43:1 against every surface). Never removed.
- Dialogs trap focus (native `<dialog>`), restore focus to the trigger on close, Esc closes.

## Charts (v2 reviews, used here for the capacity bar and history dots)
- Marks: ember for planned/primary series, jade for done, muted for grey/missed, line-strong for outlines and the
  target line. Gridlines use `line` (decorative). The 80 % capacity line and the 120 min screen line are dashed
  line-strong with a text label.
- Every chart has a one-line text summary next to it (and as `aria-label`), e.g. "Planned 240 of 300 budget minutes".
- No legends that depend on colour: label series directly.

## Copy
Calm, short, second person. No exclamation marks. "Not this time" instead of "failed". See `05-ui-ux.md`.

## Mobile sync (`apps/mobile/src/theme.ts`, owned by the mobile area)
Add these values so both clients match:
```ts
ink: "#0b0b0f", ink2: "#14141a", ink3: "#1c1c24",
line: "#2a2a33", lineStrong: "#6a6a76",
paper: "#ececf1", muted: "#8a8a96",
ember: "#f2a33a", emberSoft: "#2e2215",
jade: "#4fbf8f", jadeSoft: "#152622",
danger: "#d9776f",          // confirm step of destructive actions only
ritual: "#120f0c", ritual2: "#1a1612",
radius: { control: 8, card: 12 },
type: { p1: 30, h1: 24, h2: 18, body: 16, small: 14, timer: 72 }, lineHeight: 1.5,
motion: { fast: 120, base: 160, slow: 200 },
```
