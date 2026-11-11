# 12 · Method research and the next changes (method v2)

Written 11 Nov 2026. This file holds the research behind the next round of changes to the method, the owner's
decisions, and the requirements for each change. **Nothing here is built yet.** It is the input for planning: a
planner splits section 6 into tasks and subtasks, and a coding agent builds them.

`docs/02-method.md` still describes what the app does today. Update it only when a change from this file ships.

## 1. Owner decisions (11 Nov 2026)

| Topic | Decision |
|---|---|
| Gamification | **Gentle ranks.** Ranks that never drop, a chain that breaks only after two misses in a row, a 12-week cycle map, and a level per area. No coins, shops, leaderboards, or anything that takes progress away. |
| Gap fixes | All four: drift tags and energy tap, obstacle line on P1, character step in the weekly review, lead measure per goal. |
| Simplify | All three: cap missions at 5, hide food micronutrients, hide the Library on the phone. Nothing is deleted; each is behind a setting. |
| Earlier data | The owner tracked elsewhere before the app went live. Importing that data comes later and is not specified here (section 8). |

The gamification decision changes a written rule ("no streaks, no XP, no levels"). Section 7 lists every place that
rule is written, so the text can be changed in the same pull request as the code.

## 2. Research: reflection methods from different traditions

The app already uses Japanese ideas (Kaizen, Ikigai, Shoshin, Hara Hachi Bu, Wabi-Sabi). These are comparable daily
and weekly practices from other traditions. "Checked" means a web search on 11 Nov 2026 supported the description.
It does not mean the practice has been tested in trials; most have not.

| Tradition | Practice | What it is | Checked | Use in TATAKAE |
|---|---|---|---|---|
| Stoic (Roman) | Evening review (Seneca, *De Ira* III.36) | Review the day as a lenient judge: name the fault, then move on. Commonly put as: what went well, what went poorly, what to do differently. Sources warn against turning it into rumination. | Yes | The tone for the three questions. Already close to the current ritual. |
| Stoic | Premeditatio malorum | Picture what could go wrong today, before it does. | No (general knowledge) | The obstacle line on P1 (6.5). |
| Christian (Ignatian) | Daily Examen | A five-step nightly review. It starts with gratitude and pays attention to feelings during the day. | Yes | The energy tap (6.4). The small win already covers part of the gratitude step. |
| Islamic (al-Ghazali, *Ihya*) | Musharata, muraqaba, muhasaba | A morning agreement with yourself, watchfulness during the day, and an account at night. Al-Ghazali lists six stages in total; the later ones (penalty, striving, self-reproach) are not used here. | Yes | Same shape as morning, day and night ritual. No change needed; it supports the existing loop. |
| Confucian (Zengzi, *Analects* 1.4) | Three daily examinations | Was I faithful when acting for others? Was I trustworthy with friends? Did I practise what I was taught? | Yes | Two of the three questions are about other people, which the current three questions lack. Feeds the character step (6.6). |
| Japanese | Naikan | Three questions about one person: what did I receive, what did I give, what trouble did I cause. | Yes (method); little rigorous evidence found | The character step (6.6). |
| Japanese (Toyota) | Hansei | Own your part in what went wrong and commit to one change. | No (general knowledge) | One line at the end of the character step (6.6). |
| Jewish (Mussar; Lefin's *Cheshbon HaNefesh*) | One trait per week | Focus on one character trait each week with a short daily check. Lefin took the list and chart from Benjamin Franklin's 13 virtues. Sources agree on the weekly focus; the exact "13 weeks" detail was not confirmed for Lefin. | Partly | Deferred idea: a trait of the week across the 12-week cycle (section 8). |
| American (Franklin) | 13 virtues, 13-week chart | One virtue per week, a mark for each lapse, repeated four times a year. | Yes | Same deferred idea. |
| Hindu (Gita 2.47) | Nishkama karma | You have a right to the action, not to its fruit. | Yes | Supports scoring effort (missions done) and showing results separately (lead measures, 6.7). |
| Jain | Pratikramana | Regular review of your conduct, asking forgiveness. | No (search returned nothing) | Supports the "trouble I caused" question in 6.6. |
| Southern African | Ubuntu | "A person is a person through other persons." | No (search returned nothing) | Supports reporting progress to another person (section 8). |
| Tamil | Thirukkural | Already in the app (kural 619 on login, shutdown and welcome back). | n/a | Kural unlocks are a possible surprise reward (section 8). |

**What these have in common.** Almost every tradition has a short nightly account, a morning intention, and a
question about how you treated other people. TATAKAE has the first two. It has nothing for the third.

## 3. Research: psychology of working and tracking daily

| Finding | Source | Strength | What it means for TATAKAE |
|---|---|---|---|
| Monitoring progress raises goal attainment (d ≈ 0.40, 138 studies, about 20,000 people). The effect is larger when progress is written down and when it is reported to someone. | Harkin et al. 2016, *Psychological Bulletin* | Strong (meta-analysis of experiments) | The nightly log is the core. Add a way to report to another person (section 8). |
| If-then plans help people act (d ≈ 0.65 across 94 tests). | Gollwitzer & Sheeran 2006 (already cited in `02-method.md`) | Strong | Keep the P1 if-then. |
| Naming the obstacle before the plan (mental contrasting with implementation intentions, also called WOOP) has a small-to-medium effect (g ≈ 0.34, 21 studies). Publication bias may make the true effect smaller. | Wang, Wang & Gai 2021, *Frontiers in Psychology* | Moderate | The obstacle line (6.5). |
| Habit automaticity took 66 days on average, with a range of 18 to 254. Missing one day did not matter. Half the people were not there after 84 days. | Lally et al. 2010 | Moderate (96 people) | Expect two months or more. One miss is not a problem, which supports the grey misses and the two-miss chain (6.9). |
| Habits form when the same action is repeated in the same context (time, place, the action before it). | Wood & Neal 2007; Wood, Mazar & Neal 2021 | Strong (review) | Run the ritual at the same time and place, after the same action. This is a behaviour for the owner, not a feature. |
| In a 61,000-person gym study, 45% of 54 programmes raised visits. The best one added a small bonus for coming back after a missed visit (+27%). Experts could not predict which ones would work. | Milkman et al. 2021, *Nature* | Strong, but one gym chain | The comeback bonus is well founded. Because predictions are poor, test each change in this file as an experiment (6.1). |
| People start goals more often after a "fresh start" date (new week, month, semester, birthday). | Dai, Milkman & Riis 2014, *Management Science* | Moderate (archival data) | Start changes on a Monday or at a cycle start. The cycle map (6.10) makes these dates visible. |
| A card with two of ten stamps already filled was completed by 34% of people, against 19% for an empty eight-stamp card. | Nunes & Drèze 2006, *Journal of Consumer Research* | Moderate (one field study, secondary sources) | Start the cycle map and the rank ladder with progress already shown (6.8, 6.10). |
| Procrastination is mostly short-term mood repair, not poor time management. | Sirois & Pychyl 2013 | Moderate (theory paper with supporting studies) | The Stuck button is the right tool. Drift tags should include feelings (fear, tired), not only events (6.4). |
| Treating yourself kindly after a failure raised the motivation to improve in four lab experiments. | Breines & Chen 2012 | Moderate (small lab studies, short term) | Keep grey misses and calm copy. Nothing in the gamification may punish. |
| People stop self-tracking mainly because of hassle, loss of interest, tracking too many things, and discomfort at seeing their shortcomings. | Epstein et al. 2016 | Moderate (193 surveyed, 12 interviewed) | Reduce the tracking surface (6.2). Every new input in this file must be one tap or one line. |
| Expressive and gratitude writing have small effects on wellbeing (pooled estimates from about 0.12 to 0.47, depending on the review). | Several meta-analyses, mixed | Weak to moderate | The character step is optional and short. Do not expect large effects from it. |

Not confirmed by the searches, so not used as a basis for any requirement: temptation bundling (Milkman, Minson &
Volpp 2014) and immediate rewards predicting persistence (Woolley & Fishbach).

## 4. Research: gamification

| Finding | Source | Strength | Design rule that follows |
|---|---|---|---|
| Gamification has small positive effects. A secondary summary gives g ≈ 0.25 for behaviour and g ≈ 0.36 for motivation (not checked against the paper). The effects on motivation and behaviour were less stable in the rigorous studies. Game fiction and social interaction made the behaviour effect larger. | Sailer & Homner 2020, *Educational Psychology Review* | Moderate; mostly learning settings | Expect a small gain. A story frame (the cycle map) is worth more than points. |
| An intact streak raises later engagement a little; a broken streak lowers it (66% against 58% chose to continue in one experiment). The drop is larger when people blame themselves, and smaller when the streak can be repaired. | Silverman & Barasch 2023, *Journal of Consumer Research* | Moderate | Never show a count that resets to zero after one miss. The chain tolerates single misses (6.9). |
| Expected, tangible rewards for doing a task lowered later free-choice motivation (d from −0.28 to −0.40, 128 lab studies). Rewards that work as feedback on competence can raise it. | Deci, Koestner & Ryan 1999, *Psychological Bulletin* | Strong for tangible rewards; applying it to digital badges is an extrapolation, and the finding is contested | Ranks and levels must read as feedback on what was done ("120 hours of Craft"), not as payment. No currency, nothing to spend. |
| Badges, leaderboards and graphs raised the feeling of competence in one randomised study; other studies found no change in self-reported motivation. | Mixed small studies | Weak | Keep the game layer small and quiet. |

**Design principles for the game layer.**
1. Progress is only ever added. Nothing is lost, reset to zero or taken away.
2. Everything is computed from data the app already has. The game layer adds no new input.
3. Ranks and levels describe what was done. They are not a currency and unlock nothing that the method needs.
4. The morning screen stays as it is: no rank, chain, level or map there.
5. No notification mentions ranks, chains or levels.
6. One switch in Settings turns the whole game layer off.

## 5. Gaps and what is overdone

### 5.1 Gaps (checked in the code on 11 Nov 2026)

| # | Gap | Evidence | Fix |
|---|---|---|---|
| 1 | Drift reasons are never counted. | `days.q_drift` is free text (max 300); `packages/core/src/stats.ts` only checks whether it is filled. | 6.4 |
| 2 | Energy is never recorded per day. | `days.energy` (1–5) exists in `db/schema.ts` and the Zod schema, but both clients always write `null`. The weekly review has its own energy check. | 6.4 |
| 3 | No obstacle is named before the if-then plan. | `missions` has `minimum` and `if_then` only. | 6.5 |
| 4 | Nothing covers character, relationships or gratitude. | The ritual's three questions and the review's Muri, Mura and Muda are all about execution. | 6.6 |
| 5 | The score measures plan-following, not progress on goals. | Scoring uses the owner's own missions and points; `goals.target_points` is the only progress measure. Easy missions give a Strong day. | 6.7 |
| 6 | Nobody else sees the progress. | Single-user app; social features are a non-goal. | Section 8 (owner action, no code) |
| 7 | No view links score to sleep, energy and screen time. | The data exists in `days`, `body_logs` and `focus_sessions`, but no screen compares them. | Section 8 (needs four weeks of data first) |
| 8 | No import for earlier data. | The app starts fresh by design. | Section 8 |

Already complete, no change needed: experiments store a hypothesis, the change, the result and the decision
(`experiments` table), so the Kaizen test loop is covered.

### 5.2 What is overdone

| Area | Observation | Action |
|---|---|---|
| Life load | M.Tech, an internship, freelancing, gym, Japanese N5, Terraform, DSA and AWS SAA run at the same time. This is overload (Muri) before any app is involved. | Owner decision at the next weekly review. Not a code change. |
| Missions per day | Up to nine ranked missions. The Ivy Lee method uses six; the app's own default is five. | 6.2 (cap at 5) |
| Tracking surface | 13 micronutrients, food logs, applications, interview stories, a Japanese log and notes, on top of the ritual. | 6.2 (hide micronutrients; hide the Library on the phone) |
| Review layers | An eight-step nightly ritual, plus weekly, monthly and cycle reviews. | No cut now. Every addition in this file must fit the existing time limits (6.1). |
| Engineering | Passkeys, step-up re-auth and a security event log for a one-user app. | Keep; already built. Do not add more. |
| Building over doing | The first month of Cycle 1 (12 Oct to 11 Nov) went into building the tool. | Ship the changes below in small steps and use each one before the next (6.1). |

## 6. Requirements

These are requirements, not tasks. Field names, thresholds and screen positions marked **proposal** are suggestions
for the planner; the rest is decided.

### 6.1 Rules for every change in this section

- The night ritual stays at 5 minutes or less, and logging a day stays at 60 seconds or less. Every new input is one
  tap or one short line, and every new input can be skipped.
- The morning screen does not change.
- No new notifications.
- Misses stay grey. No copy says "failed", and no exclamation marks.
- All new logic (ranks, chain, levels, lead totals, drift counts) lives in `@tatakae/core` with table-driven tests,
  and both clients use it. "Today" comes from `todayIST()`.
- All writes go through the outbox on both clients.
- Build on the website and the phone together, so the two do not drift apart again.
- **Suggested order:** 6.2 → 6.4 → 6.5 → 6.8 and 6.9 → 6.10 and 6.11 → 6.6 → 6.7. The simplifications and the
  one-tap inputs come first because they lower the daily load and start collecting data. Lead measures come last
  because they need the largest data change.
- Because experts could not predict which interventions work (section 3), record each shipped change as an entry in
  the existing `experiments` table and judge it at a weekly review two weeks later.

### 6.2 Simplify: cap missions at 5

- A new setting, **proposal** `plan.maxRanked`, default 5, allowed 5 to 9.
- The night ritual, the week planner and the phone's Plan sheet offer only P1 up to that number. The "Add" row
  disappears when the cap is reached.
- Missions that already sit in a higher slot stay visible and scored. The slot list in the schema (P1 to P9) does
  not change, so no data migration is needed.
- The setting lives in Settings → Scoring or General on both clients. It is not behind the even-Sunday guard.

### 6.3 Simplify: hide micronutrients, hide the Library on the phone

- A new setting, **proposal** `fitness.showMicros`, default off. When off, the Fitness day view shows calories and
  protein first, the other macros in the existing macro row, and no "more nutrients" block. Food entry forms hide
  the micronutrient fields. Stored values are kept and still exported.
- A new setting, **proposal** `mobile.showLibrary`, default off. When off, the phone's Settings screen does not show
  the Library entry (applications, interview stories, Japanese log). The website is unchanged.

### 6.4 Drift tags and the daily energy tap

- **Where:** night ritual step 3 (three questions) on both clients, and the phone's Quick close.
- **Drift tags:** a row of one-tap chips above the "What made me drift?" text. More than one can be picked; none is
  required. **Proposal** for the fixed set: phone, tired, unclear task, fear, overload, interrupted, other. The first
  five match the causes in section 3 and the Stuck button's three types (uncertainty, fear, inertia).
- The free-text answer stays, as an optional detail.
- **Energy:** five one-tap chips (1 to 5) in the same step, written to the existing `days.energy` column.
- **Data:** drift tags need a new nullable column on `days` (**proposal** `drift_tags`, a JSON array of tag ids), in
  the Drizzle schema, a migration, the Zod row schema, the sync row and the day patch input.
- **Review:** the weekly review's Mura step shows the count for each tag this week and the average energy. The
  monthly review shows the same for the month.
- **Core:** a function that counts tags over a date range, with tests.

### 6.5 Obstacle line on P1

- **Where:** night ritual step 6 (pick ranked missions), in the P1 row, before the if-then field. Also wherever P1
  can be edited on the phone.
- One line: "What is most likely to stop this?" When filled, the if-then placeholder becomes "If [the obstacle],
  then I will…".
- **Proposal:** optional. The plan lock does not require it, so the lock rules and `FORGE_PROBLEM_COPY` do not
  change. Revisit after two weeks of use.
- **Data:** a new nullable text column on `missions` (**proposal** `obstacle`, max 200 characters), with the same
  schema, migration and sync changes as 6.4.
- The morning P1 card does not show the obstacle (the if-then already carries it).
- The weekly review's Mura step lists this week's obstacles beside the drift tags, so the owner can see whether the
  named obstacle was the one that happened.

### 6.6 Character step in the weekly review

- **Where:** the weekly review on both clients, as a new step after Muda and before the experiment.
- Four short optional fields:
  1. A person this week (free text).
  2. What I received from them.
  3. What I gave them.
  4. What trouble I caused them.
- Then one Hansei line: "My part in this week's misses was … Next week I will …".
- The whole step can be skipped with one tap. It does not affect the score, the reward unlock or review completion.
- **Data:** new nullable text columns on `reviews` (**proposal** `person`, `received`, `gave`, `troubled`,
  `hansei`).
- This is private writing. It is included in the data export like every other field, and shown nowhere else.
- Evidence for Naikan is thin (section 2). Treat this step as a practice the owner wants, not as a proven technique.

### 6.7 Lead measure per goal

- Each cycle goal gets one **lead measure**: a number the owner controls each week, shown beside the score.
- Two kinds:
  - **Focus minutes (automatic).** The sum of focus sessions on missions linked to the goal. No new input.
  - **Count (manual).** A named unit, for example "problems solved" or "gym sessions", entered as one number.
- **Proposal** for goal fields: `lead_kind` (`focus` or `count`), `lead_unit` (text), `lead_weekly_target`
  (integer).
- **Proposal** for count entries: a new synced table `goal_lead_logs` (`id`, `goal_id`, `date`, `value`). Entry
  happens in the night ritual's close step as one stepper per goal that has a count measure, and can be skipped. If
  the planner finds that this breaks the 5-minute limit, enter counts once a week in the weekly review instead.
- **Where shown:** the Cycle page (this week against the weekly target, for each goal), the weekly review's stats
  step, and the Today dashboard's goal rings on the website.
- The lead measure does **not** change the daily score. It sits beside it, so a Strong day with no lead progress is
  visible.
- **Core:** a function that returns, for each goal and ISO week, the total, the target and the ratio, with tests.

### 6.8 Game layer: ranks

- A rank from the cumulative **days shown up** (the existing never-resetting count in `stats.ts`). A rank is never
  lost.
- Names follow the kyu and dan grading used in Japanese arts: 10th kyu up to 1st kyu, then 1st dan and above. No
  belt colours are needed; use the existing tokens and a number.
- **Proposal** for thresholds (days shown up):

  | Rank | 10 kyu | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 kyu | 1 dan | 2 dan | 3 dan |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Days | 0 | 3 | 7 | 14 | 21 | 30 | 45 | 60 | 80 | 100 | 150 | 250 | 365 |

  The early steps are close together (endowed progress and the goal-gradient idea in section 3). The 60 to 80 range
  matches the 66-day habit average and the 84-day cycle.
- **Where shown:** beside "days shown up" on the Today dashboard (after P1 is started or deferred), on the Cycle
  page, and on the shutdown screen when a new rank is reached ("3rd kyu. 60 days shown up."). One calm line, no
  animation beyond the existing reduced-motion-safe transitions.
- Days imported later (section 8) count toward the rank.

### 6.9 Game layer: the chain

- A count of consecutive days with **no two missed days in a row**. One missed day does not break it. Rest days and
  write-off days neither break it nor add to it.
- "Missed day" uses the existing `missedDay` rule from scoring.
- When two missed days in a row end a chain, the app shows the new chain from the comeback day and keeps "best
  chain" as a record. It never shows zero: the comeback day is day 1.
- After one missed day the chain shows a neutral note, **proposal** "One miss. Tomorrow keeps the chain." in the
  existing grey, not as a warning. This must not become a notification.
- **Where shown:** next to the rank. Not on the morning screen.
- This replaces nothing: "days shown up" stays as the main number.
- **Core:** a pure function over dated scores and day kinds, with tests for: a single miss, two misses, a miss next
  to a rest day, a write-off day, and the first day of use.

### 6.10 Game layer: the cycle map

- The 12-week cycle shown as 12 stages in a row, with the current week marked.
- A stage is **complete** when that week's review is done. This rewards the review, not the score.
- A stage also shows the week's average mark with the existing DayCircle colours (grey for Light, never red).
- A "stage 0: goals set" is complete from the start, when the cycle has at least one goal that passed the hell-yeah
  gate (endowed progress, section 3).
- **Where shown:** the top of the Cycle page on both clients. It can reuse or replace the existing SegmentGauge.
- Follow `docs/10-design-system.md` and `docs/11-dashboards-charts-calendar.md`: tokens only, a text label for every
  stage state, and a screen-reader summary.

### 6.11 Game layer: area levels

- A level for each area from its cumulative focus minutes (`focus_sessions.area_id`, or the area of the mission's
  goal when the session has no area).
- **Proposal** for thresholds in hours: level 1 at 0, then 5, 15, 30, 50, 80, 120, 170, 230, 300. Shown as "Craft ·
  level 4 · 34 h", so the level reads as a record of hours and not as a reward.
- **Where shown:** the Cycle page's area list and the monthly review's area section.
- Levels never drop.

## 7. Rule text to change when the game layer ships

The decision in section 1 narrows the old rule. The new rule: **"No resetting streaks, no XP, no coins, no
leaderboards. Ranks, the two-miss chain, the cycle map and area levels are allowed; they only ever add."**

| File | Current text | Change |
|---|---|---|
| `CLAUDE.md` (hard rules) | "no streaks/XP" | Replace with the new rule. |
| `docs/01-overview.md` (design rule 4, non-goals) | "No streaks."; non-goals list "XP, levels, coins…" | Reword rule 4; remove "levels" from the non-goals and keep the rest. |
| `docs/02-method.md` | Lapse protocol | Add ranks, chain, cycle map and area levels, and the changed ritual and review steps. |
| `docs/DECISIONS.md` item 9 | "No streaks, no XP" | Already amended by item 15; no further change. |
| `docs/FEATURES.md` | "Deliberately not built: XP, levels, coins, streaks…" | Reword; add the new features with their status. |
| `.claude/skills/tatakae-guardrails/SKILL.md` item 4 | "No streak counters, no resets to zero, no XP, levels…" | Reword to the new rule. Keep "no resets to zero". |
| `docs/05-ui-ux.md`, `docs/10-design-system.md` | Screen specs | Add the new elements where they appear. |

## 8. Deferred (not in this round)

| Item | Why it waits |
|---|---|
| Insights page: score against sleep, energy and screen time | Needs about four weeks of energy and drift data first. |
| Reporting to another person | The research supports it (section 3). Start by hand: the owner sends one line a week to a friend or mentor. A "share this week" button can follow if the habit holds. |
| Trait of the week across the cycle (Mussar and Franklin) | Adds a daily check. Decide after the character step has been used for a month. |
| Kural unlocks as a surprise reward | Small and optional. Decide after the game layer has been used. |
| Importing the owner's earlier tracking data | Needs the source and its format from the owner. Imported days should count toward ranks and area levels. |
| A weekly "boss" mission and a story frame | The owner chose the gentler option. Revisit only if the game layer feels too quiet. |

## 9. Sources

Research papers and summaries:
- Harkin et al. 2016, monitoring goal progress: https://eprints.whiterose.ac.uk/91437/
- Wang, Wang & Gai 2021, MCII meta-analysis: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8149892/
- Cross & Sheffield 2019, mental contrasting for health behaviour: https://pubmed.ncbi.nlm.nih.gov/30879403/
- Lally et al. 2010, habit formation (UCL summary): https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit
- Wood, Mazar & Neal 2021, habits and goals: https://marketing.wharton.upenn.edu/wp-content/uploads/2022/02/Wood.Mazar_.Neal_.2021.pdf
- Milkman et al. 2021, megastudy: https://ideas.repec.org/a/nat/nature/v600y2021i7889d10.1038_s41586-021-04128-4.html
- Megastudy summary: https://www.weforum.org/stories/health-and-healthcare-systems/science-fitness-goal-motivation/
- Dai, Milkman & Riis 2014, fresh start effect: https://anderson-review.ucla.edu/wp-content/uploads/2021/03/Dai-Milkman-Riis_FreshStartEffect_2014_Mgmt_Sci.pdf
- Nunes & Drèze 2006, endowed progress (summary): https://www.renascence.io/us/behavioral-biases/endowed-progress-effect
- Sirois & Pychyl 2013, procrastination and mood regulation: https://eprints.whiterose.ac.uk/91793
- Breines & Chen 2012, self-compassion: https://static1.squarespace.com/static/50f6f441e4b08191027c661d/t/51663d46e4b060cd9194ed75/1365654854068/Breines+&+Chen+2012+PSPB.pdf
- Epstein et al. 2016, life after self-tracking: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5428074/
- Expressive writing reviews: https://pmc.ncbi.nlm.nih.gov/articles/PMC10702225 and https://link.springer.com/article/10.1007/s10608-023-10417-1
- Sailer & Homner 2020, gamification meta-analysis: https://opus.bibliothek.uni-augsburg.de/opus4/frontdoor/index/index/docId/109056
- Silverman & Barasch 2023, broken streaks: https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb
- Broken streaks summary: https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation
- Deci, Koestner & Ryan 1999, rewards and intrinsic motivation: https://pubmed.ncbi.nlm.nih.gov/10589297/

Traditions:
- Stoic evening review: https://modernstoicism.com/?p=5766
- Ignatian Examen: https://www.amdgchinese.org/en/?p=14617
- Al-Ghazali's stages of muhasaba: https://journal.uthm.edu.my/index.php/JTS/article/view/26441
- Analects 1.4: https://ctext.org/analects/xue-er/ens?en=on
- Naikan: https://en.wikipedia.org/wiki/Naikan
- Cheshbon HaNefesh: https://www.sefaria.org/Cheshbon_HaNefesh
- Franklin's virtues and Mussar: https://www.algemeiner.com/2021/01/12/ben-franklins-virtues-and-jewish-practice/
- Nishkama karma: https://en.wikipedia.org/wiki/Nishkama_Karma
