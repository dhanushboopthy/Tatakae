# 13 · UI/UX research, friction and the work list (planner entry point)

Written 11 Nov 2026. **Nothing here is built yet.**

**For the planner:** this is the one file to start from. Section 7 is the complete work list. It covers the UI/UX
changes in this file and the method changes in `12-method-research.md` §6, in one order. Read section 6 here before
planning any item from file 12, because it changes where some of those inputs go.

## 1. The owner's brief

1. Research UI and UX, and apply it.
2. Reduce friction.
3. Make buttons simple: one colour system, one placement.
4. The owner writes and updates a lot. Many methods and many inputs are fine. What is not fine:
   - a clumsy screen (too many actions, unclear which one matters);
   - entering the same thing twice in two places.

Point 4 changes one rule from file 12. File 12 §6.1 said every new input must be "one tap or one short line". The
rule is now: **an input may be as rich as the owner wants, but each fact is entered once, and no screen competes for
attention.** Text fields stay visible; they are not hidden behind extra taps.

## 2. Research

"Checked" means a web search on 11 Nov 2026 supported the statement. Unchecked rows are general design knowledge and
are marked so.

| Principle | Source | Checked | Rule for TATAKAE |
|---|---|---|---|
| Friction is physical effort plus mental effort, not the number of clicks. | Nielsen Norman Group, interaction cost | Yes | Count seconds and decisions for each core flow, not taps alone (7, item U10). |
| A layout should have one prominent button, so the others clearly matter less. | Material Design, buttons | Yes | Exactly one primary button on a screen or sheet (4.1). |
| The minimum touch target is 48 dp on Android. | Material Design (seen on the Wear and component pages) | Partly | The project's 44 dp minimum stays; the default button height is already 52. |
| Bottom navigation holds three to five destinations. | Material Design, bottom navigation | Yes (older pages) | The phone may go from four tabs to five, not more (4.4). |
| 49% of people were seen using a phone with one hand, on the thumb. The well-known green, yellow and red "thumb zone" map is disputed, including by its author. | Hoober 2013 (1,333 observations) | Yes | Put the primary action at the bottom of the phone screen, full width. Do not depend on a corner. |
| Single-column forms cause fewer skipped fields and fewer errors. Two or three inputs that form one thing may share a line. | Baymard Institute | Yes | One column. Only "kg × reps" style pairs share a row (4.3). |
| Autosave prevents lost work. It does not have to replace a Save button. | Nielsen Norman Group | Yes | Text in rituals, reviews and notes saves by itself. Forms that create a row keep a Save button (4.3). |
| Confirmation dialogs are for serious, irreversible actions. Used for routine actions, people learn to dismiss them. For reversible actions, let it happen and offer undo. | Nielsen Norman Group; design-system guidance | Yes (undo part from secondary sources) | Undo for anything reversible; confirm only what cannot be undone (4.2). |
| Button order should follow the platform and stay the same across the product. Specific labels beat "OK". | Nielsen Norman Group; Carbon | Yes (partly secondhand) | One fixed order and one vocabulary (4.1). |
| Mixing automatic capture with manual entry lowers the burden of tracking. | Matthews & Kientz framework; Choe et al. | Partly | Derive a value before asking for it (4.3, 5.1). |
| People stop tracking mainly because of hassle and tracking too many things. | Epstein et al. 2016 (also in file 12) | Yes | Double entry is the first thing to remove (5.1). |
| Carrying the previous entry forward, so only the difference is typed. | Practitioner sources | Weak | Already used in Fitness ("same again", copy yesterday). Extend it (4.3). |
| More choices mean a slower decision (Hick's law). Bigger and closer targets are faster to hit (Fitts's law). Show advanced options only on request (progressive disclosure). | General knowledge | No | Supports one primary action, large bottom buttons, and grouping in navigation. |

Already in `05-ui-ux.md` and still valid: friction belongs on distractions and on changing a locked plan, never on
logging.

## 3. What the code shows today (checked 11 Nov 2026)

None of this has been run on a phone yet, so tap counts and timings are unknown. The counts below are from the
source files.

### 3.1 Buttons

| Finding | Evidence |
|---|---|
| The phone has two competing "main" colours. | `BigButton` has five variants. Its comment says `primary` (charcoal) is "one per screen" and `accent` (lime) is for Start and Save. In use: `accent` 38 times, `primary` 6, `secondary` 58, `quiet` 46, `danger` 6. |
| Several phone screens have more than one lime button. | Per file: `fitness/overview` 6, `library` 5, `manage` 4, `inbox` 3, `(tabs)/focus` 3, `fitness/targets` 3, `notes/[id]` 2, `review` 2. Some of these sit on different steps or sheets, so each needs a look. |
| The website has no shared button component. | No `Button` file in `apps/web/src/components`. Button styles are written on each screen: `bg-surface-2` 91 times, `bg-lime` 49, `bg-charcoal` 22 across routes and components. |
| Button rows are laid out three ways on the website. | `justify-between` 41, `justify-center` 13, `justify-end` 12 in the route files. |
| The same action has several names. | Website: "Save" 12 times plus "Save changes", "Save only", "Save and go", "Save goal" and five more; "Log", "Log weight", "Log practice"; "Delete", "Delete note", "Delete session", "Remove". Phone: "Remove", "Yes, delete it", "Yes, delete this food", "Write off", "Write today off". |
| Some screens carry a lot of buttons. | Phone `manage` has 21 `BigButton`s, `fitness/overview` 16, `library` 15. |

### 3.2 Double entry

| # | The same fact, entered twice | Evidence |
|---|---|---|
| D1 | Japanese study minutes. | `japanese_log.minutes` is typed by hand. A focus session on a Japanese mission already records the minutes in `focus_sessions`. |
| D2 | A gym session. | It can be a habit tick, a mission status and a workout log. Nothing links the three. |
| D3 | Screen minutes. | The phone's Quick close fills them in from usage access. The phone's night ritual has no usage code, and the website ritual is typed by hand. |
| D4 | Wins and drift. | The weekly and monthly reviews ask for "Wins" again. Neither review screen reads the daily `smallWin`, `qDrift` or `qPractised` answers (no references in `WeeklyReview.tsx`, `MonthlyReview.tsx`, `ReviewParts.tsx` or the phone's `review.tsx`). |
| D5 | Energy. | The weekly review has three 1 to 5 scales (capacity, burnout, capability). File 12 §6.4 adds a daily energy tap. Capacity and daily energy would measure nearly the same thing. |
| D6 | Mission status. | Set with the chips during the day, and again in ritual step 1. **To verify on a device:** step 1 should show what is already set and ask only about open missions. |
| D7 | Counts for a lead measure. | File 12 §6.7 proposes a typed weekly count per goal. Workouts, Japanese minutes and applications sent are already recorded in their own tables. |

Not a problem: the maintenance calories can be edited from three screens, but it is one record. Several doors to one
record are fine; several records of one fact are not.

### 3.3 Navigation

| Finding | Evidence |
|---|---|
| The phone has four tabs and about 28 screens. Most screens are reached from links placed where there was room. | Today links to the ritual, Quick close, inbox, review, morning and capture. Calendar links to the cycle, notes and the planner. Settings links to the Library and "More settings". The Fitness card links to five screens. |
| A screen's home is not predictable. | Notes are under Calendar; reviews are under Today; the Library is under Settings. |
| The website's rail has ten items in one flat list. | `Shell.tsx`: Today, Calendar, Focus timer, Night ritual, Inbox, Review, Cycle, Fitness, Notes, Settings. |

### 3.4 Already good, keep

- No blocking browser confirms or native alerts anywhere.
- Undo exists for inbox discard and for status chips.
- The ritual autosaves and can be resumed.
- Fitness has "same again", "copy yesterday" and last-time prefill.
- Every synced row has `deleted_at`, so undo is cheap to add everywhere.

## 4. The rules

### 4.1 Buttons

**Four roles, on both clients.**

| Role | Look | Use | Limit |
|---|---|---|---|
| Primary | Lime fill, ink text | The one action that saves or moves forward | Exactly one per screen or sheet |
| Secondary | `surface-2` fill, ink text | Other real actions | As few as possible |
| Quiet | Text only, underlined | Cancel, Back, Skip, links | No limit |
| Danger | Danger fill, white text | The final step of a permanent delete only | Never beside a primary button |

- **Charcoal is not a button colour.** It stays for the P1 hero card, the navigation and the round "+" capture
  button. The phone's `primary` (charcoal) variant is removed, and its six uses become lime or secondary. Lime is
  chosen because the design system already names lime as the primary accent and most main buttons already use it.
- **Proposal:** on a white surface, give the lime button a 1.5 px `lime-deep` edge. Lime on white is 1.4:1, and the
  design system already uses this edge for chart marks.
- If a screen needs two forward actions (for example "Save" and "Save and go"), one is primary and the other is
  secondary. If neither is clearly the main one, the screen is doing two jobs and should be split.

**Placement.**

| Where | Rule |
|---|---|
| Phone screen or sheet | Primary at the bottom, full width, in a footer that stays above the keyboard and the safe area. A secondary sits above it or to its left. Back or Cancel is at the top left, and the Android back gesture does the same. |
| Phone list row | Row actions are compact (44 dp) and never lime. |
| Website dialog | Bottom right. Order: Cancel, then the primary on the far right. Enter confirms; Esc cancels. |
| Website wizard (ritual, reviews) | Back at the bottom left, Next at the bottom right. This is the layout already used most. |
| Website page form | Buttons directly under the last field, left-aligned with the fields. |
| Delete, on both | Never in the footer next to the primary. It sits at the end of the form, apart, or in a "more" menu. |

**One word for one meaning.**

| Word | Meaning |
|---|---|
| Save | Keep changes to something that exists |
| Add | Create a new item |
| Log | Record a measurement or an event (weight, food, a set, practice) |
| Delete | Remove for good |
| Remove | Take out of a list without deleting it (a tag, an exercise from a session) |
| Cancel | Leave without keeping changes |
| Back, Next, Skip, Done | Wizard steps |

- Add an object only when the screen has more than one thing to save ("Save goal"). Otherwise the label is one word.
- "Save and go", "Save only" and "Save changes" disappear.
- A disabled button always has a short line next to it saying what is missing.

### 4.2 Undo and confirmation

- **Reversible actions happen at once and show an undo toast.** This covers every delete of a synced row, discard,
  status changes and removing an item from a list.
- **A confirmation is only for:** changing a locked plan (the typed reason), restarting the ritual, signing a device
  out, and deleting something that has children (an area with goals, a goal with missions).
- **Hold to confirm** stays only for Shutdown complete and the ritual restart.
- No "Are you sure?" on anything else. "Yes, delete it" style second buttons go away where undo exists.

### 4.3 Entering data

1. **One fact, one record, entered once.** It may be shown anywhere and edited from several screens, but it is the
   same record.
2. **Derive before asking.** If the app already knows a value (focus minutes, phone usage, a logged workout), it
   fills the field in and says where the value came from. The owner can change it.
3. **Carry forward.** A new entry starts from the last one where that makes sense (yesterday's meals, last session's
   sets, last week's maintenance, the previous if-then).
4. **Reviews read before they ask.** A review step first shows what the owner already wrote that week, then offers
   one field for a new thought.
5. **Text saves itself.** No Save button for writing in the ritual, reviews or notes. A small "Saved" line confirms
   it. Forms that create a row keep one Save or Add button.
6. **Chips and text together.** Where there are one-tap chips, the text field sits right below them, visible, one
   line tall, and grows as the owner types. It is never hidden behind "Add a note".
7. **One column.** Only values that form one thing share a row (kg × reps, start and end time).
8. **The keyboard carries the flow.** Phone: the Next key moves to the next field, the last field submits, numbers
   get the number pad, and the footer button stays above the keyboard. Website: Tab order follows the screen, Enter
   moves on in a wizard, Ctrl or Cmd + Enter saves a form, and the first field has focus on open.
9. **Nothing typed is ever lost.** Drafts are kept per day or per item until saved or cleared.
10. **Capture has no categories.** It goes to the inbox; triage decides what it becomes (already the case).

### 4.4 Screens and navigation

1. **A screen does one job** and has one primary action.
2. **Every screen has one home.** It is reached from one predictable place. A shortcut is allowed only when it is
   about now (the ritual prompt after ritual time, Quick close in the evening, Welcome back after a miss).
3. **No chains of sheets longer than two** (already a rule).
4. **Proposal for the phone: five tabs.**

   | Tab | Holds |
   |---|---|
   | Today | Morning, missions, habits, the Fitness card, timely shortcuts |
   | Plan | Calendar, week planner, cycle and goals, inbox |
   | Focus | Timer, stuck, recharge |
   | Reflect | Night ritual, Quick close, weekly and monthly review, notes |
   | More | Fitness (week, month, training, phase, foods), Library, settings |

   Capture stays as the "+" in every header.
5. **Proposal for the website:** keep the ten rail items, grouped with a small gap in the same order: Do (Today,
   Focus, Inbox) · Plan (Calendar, Cycle) · Reflect (Night ritual, Review, Notes) · Body (Fitness) · Settings.
6. Long management screens (`manage`, `fitness/overview`, `library`) are split by section, so each view has one
   primary action.

## 5. Requirements

Items marked **proposal** are suggestions for the planner. The rest is decided by the brief in section 1.

### U1 · One button system
- Website: a shared `Button` component with the four roles in 4.1, and every route uses it. No button styles written
  on a screen.
- Phone: `BigButton` keeps `accent` (renamed primary), `secondary`, `quiet` and `danger`. The charcoal variant goes.
- Every screen and sheet is checked against "exactly one primary". The files in 3.1 are the starting list.
- Add the rule to `10-design-system.md` §5 and to the guardrails skill.

### U2 · Placement
- Apply the table in 4.1. The phone gets one shared footer component for the primary action; the website gets one
  dialog footer and one wizard footer.

### U3 · Vocabulary
- Apply the word table in 4.1 to every button label on both clients.

### U4 · Undo, not confirm
- A shared undo toast on both clients that works for any synced row (it clears `deleted_at` or restores the old
  value through the outbox).
- Remove second-step delete buttons where undo now covers the action. Keep the confirmations listed in 4.2.

### U5 · Remove double entry
- **D1 Japanese minutes.** When a focus session ends on a mission whose area or goal is Japanese, the app offers to
  log it as practice with the minutes filled in; only the kind (anki, reading, listening, speaking, writing) is
  picked. Manual entry stays for study done away from the timer. **Proposal:** store the link so one session cannot
  be logged twice.
- **D2 Gym.** Logging a workout ticks the linked habit for that day and offers to mark the linked mission done. The
  link is set once (**proposal:** a habit and a mission can point to "workout logged today").
- **D3 Screen minutes.** One value per day. The phone writes the usage figure to the day when usage access is on;
  the phone ritual and the website ritual show that figure, with its source, and let the owner change it.
- **D6 Mission status.** Ritual step 1 shows statuses already set and asks only about open missions. Verify first;
  fix if it re-asks.

### U6 · Reviews reuse what was written
- The weekly review shows the week's daily small wins, drift answers (and tags, after file 12 §6.4), "what did I
  practise" answers and obstacles, each in the step where it helps: wins in the stats step, drift and obstacles in
  Mura.
- The review's own fields stay, for the summary thought. Their placeholder changes to say that the daily notes are
  above.
- The monthly review does the same with the weekly reviews' summaries.

### U7 · One energy measure
- After the daily energy tap exists (file 12 §6.4), the weekly review shows the week's average energy.
- **Proposal:** drop the weekly "capacity" scale, since daily energy covers it, and keep "burnout" and "capability".
  The `reviews.capacity` column stays in the database for old reviews.

### U8 · Navigation
- Apply 4.4: one home per screen, the five phone tabs (proposal), the grouped website rail (proposal).
- Remove links that only existed as a second way in. Keep the timely shortcuts.

### U9 · Typing flow
- Apply 4.3 rules 5 to 9 on both clients: autosave with a "Saved" line, visible text under chips, keyboard order,
  number pads, the footer above the keyboard, and drafts.

### U10 · Measure friction
- Before changing anything, run the eight core flows on the real phone and the website and write down seconds and
  taps: start P1 in the morning, mark a mission, capture, log a food, log a set, Quick close, the night ritual, the
  weekly review.
- The targets already in `05-ui-ux.md` apply (10 s to Start, 5 s per action, 5 s capture, 45 s Quick close, 5 min
  ritual). **Proposal** for the missing ones: 20 s to log a food from recents, 10 s to log a "same again" set.
- Measure again after each group in section 7. This needs the owner and the device.

## 6. Changes to the requirements in file 12

Read these with `12-method-research.md` §6. Where they differ, this file wins.

| File 12 item | Change |
|---|---|
| §6.1 "one tap or one short line" | Replaced by the brief in section 1: rich inputs are fine, entered once, on an uncluttered screen. The time limits for the ritual and logging still apply to the required parts; optional writing may take longer. |
| §6.4 Drift tags and energy | The existing "What made me drift?" text field stays visible under the chips (rule 4.3.6). Energy is entered here only; the weekly review reads it (U7). |
| §6.5 Obstacle line | The if-then field is prefilled with "If [obstacle], then " once the obstacle is typed, so the obstacle is not typed twice. |
| §6.6 Character step | The Hansei line is shown after the week's drift answers and obstacles (U6), so the owner reads before writing. |
| §6.7 Lead measure | Add a third kind before "count": **derived**, read from data that already exists (workouts logged, Japanese minutes, applications sent, focus minutes). A typed count is only for things the app does not record anywhere. This removes D7. |
| §6.2 and §6.3 Simplify | See the open question in section 8. |
| §6.8 to §6.11 Game layer | Unchanged. It adds no buttons and no inputs. Ranks and the chain sit on existing cards, not on new screens. |

## 7. The work list, in order

| Group | Items | Why this position |
|---|---|---|
| 0 | U10 (measure now) | A baseline, and the first real run on the phone. Bugs found here come first. |
| A | U1, U2, U3, U4 | The button system and undo. Everything built later uses them. |
| B | U5, U6, U9 | Removes double entry and makes typing smooth, before any new input is added. |
| C | File 12 §6.2, §6.3, §6.4, §6.5, with U7 | The simplifications and the two daily inputs, placed by the rules above. |
| D | U8 | Navigation, once the set of screens is known. |
| E | File 12 §6.8 to §6.11, and the rule text in file 12 §7 | The game layer. |
| F | File 12 §6.6, §6.7 (with the "derived" kind) | The character step and lead measures. |

Rules for every item: both clients together; logic in `@tatakae/core` with tests; writes through the outbox; run the
`tatakae-guardrails` skill on every changed screen; follow `10-design-system.md` tokens.

## 8. Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | Lime as the only primary button colour, with charcoal kept for the P1 card, navigation and "+"? | Yes |
| 2 | Five phone tabs (Today, Plan, Focus, Reflect, More)? | Yes |
| 3 | You said many methods are fine. Do the three simplifications from file 12 still stand (cap missions at 5, hide micronutrients, hide the Library on the phone)? | Keep the mission cap. Decide the other two after the navigation change, since the clutter may be gone by then. |
| 4 | Drop the weekly "capacity" scale once daily energy exists? | Yes |
| 5 | Keep manual entry in the Japanese log for study done away from the timer? | Yes |

## 9. Limits of this file

- The app has not been run on a phone. Every finding in section 3 comes from reading the code.
- Button counts are per source file, not per visible screen.
- D6 is not verified.
- The Hick's law, Fitts's law and progressive disclosure row is not backed by a source found in this search.

## 10. Sources

- Nielsen Norman Group, interaction cost and efficiency: https://www.nngroup.com/articles/efficiency-vs-expectations/
- Nielsen Norman Group, confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/
- Nielsen Norman Group, OK and Cancel order: https://www.nngroup.com/alertbox/ok-cancel.html
- Material Design, buttons: https://material.io/go/design-buttons
- Material Design, bottom navigation: https://material.io/components/bottom-navigation
- Android, navigation bar: https://developer.android.com/develop/ui/compose/components/navigation-bar
- Hoober, how users hold mobile devices: https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
- One-hand phone design: https://smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/
- Baymard Institute, avoid multi-column forms: https://baymard.com/blog/avoid-multi-column-forms
- Baymard Institute, accidental taps: https://baymard.com/research-articles/handling-accidental-taps-on-touch-devices
- Destructive actions (Automattic design system): https://system.automattic.design/foundations/destructive-actions/
- Carbon design system, button usage: https://carbon-website-co60rhrzz.vercel.app/components/button/usage
- Memory-free interaction (Yale usability): https://usability.yale.edu/ux/best-practices/memory-free-interaction
- Low-burden self-tracking (Luo, advised by Choe): https://drum.lib.umd.edu/bitstream/1903/28753/2/Luo_umd_0117E_22389.pdf
- Epstein et al. 2016, life after self-tracking: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5428074/
