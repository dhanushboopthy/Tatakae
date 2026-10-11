# 09 · Claude Code skills and workflow

## Install (once per machine)
Run `bash scripts/setup-claude.sh` from the repo root, or paste the commands below. Plugins install to your user scope; restart Claude Code afterwards.

| Source | Install | What you get | Used for |
|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | `claude plugin marketplace add anthropics/skills` → `claude plugin install example-skills@anthropic-agent-skills` | frontend-design, webapp-testing, mcp-builder, skill-creator, theme-factory, web-artifacts-builder… | Web UI direction, Playwright checks of web screens, writing project skills |
| (optional) same marketplace | `claude plugin install document-skills@anthropic-agent-skills` | pdf, docx, xlsx, pptx | Exporting reviews/reports |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` → `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill` (alt: `npm i -g ui-ux-pro-max-cli && uipro init --ai claude`) | Searchable styles, palettes, font pairings, charts, React + React Native + Tailwind guidelines (needs Python 3) | Design system, screen reviews, chart choices |
| [obra/superpowers](https://github.com/obra/superpowers) | `claude plugin install superpowers@claude-plugins-official` | brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review | Phase planning, TDD for core/api, debugging, verifying gates |
| [expo/skills](https://github.com/expo/skills) | `claude plugin install expo@claude-plugins-official` | expo-router, expo-dev-client, eas-update, eas-workflows, expo-module, expo-upgrade, expo-ui… | Phone app, native modules (usage stats), builds, SDK upgrades |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill react-best-practices` (repeat for `react-native-skills`, `web-design-guidelines`, `composition-patterns`) | React / RN performance and composition rules, web design review | Code quality on web + phone |
| [hashicorp/agent-skills](https://github.com/hashicorp/agent-skills) | `claude plugin marketplace add hashicorp/agent-skills` → `claude plugin install terraform@hashicorp` | terraform-style-guide, terraform-test, refactor-module… | `infra/terraform` (OCI) |
| **Project skills** (this repo) | already in `.claude/skills/` | `tatakae-guardrails`, `tatakae-phase-gate`, `tatakae-story-pack` | Enforce the method's rules, verify gates, add story references safely |

If `claude-plugins-official` isn't found, update Claude Code; the official marketplace ships with it.

## Which skill when
| Task | Skills |
|---|---|
| Start of a phase | superpowers:brainstorming → superpowers:writing-plans (plan saved to `docs/plans/phase-X.md`) |
| core / api logic | superpowers:test-driven-development, verification-before-completion |
| Design system & tokens | ui-ux-pro-max (constraint: tokens in 05-ui-ux.md), frontend-design |
| Web screens | frontend-design, react-best-practices, web-design-guidelines, webapp-testing, tatakae-guardrails |
| Phone screens | expo-router, react-native-skills, ui-ux-pro-max (React Native stack), tatakae-guardrails |
| Native module (usage stats, widget) | expo-module, expo-dev-client |
| Builds / OTA | eas-workflows, eas-update |
| Terraform | terraform-style-guide, terraform-test |
| Bugs | superpowers:systematic-debugging |
| End of a phase | tatakae-phase-gate, superpowers:requesting-code-review |
| Adding anime/film references | tatakae-story-pack |

## Working rhythm (per session, ≤ 90 min)
1. `/clear`, then: "Read CLAUDE.md and docs/06-phases.md. Continue phase X from the first unchecked task."
2. One task → one branch → one PR. Tick the box in `docs/06-phases.md`.
3. Before merging: typecheck, tests, guardrails review.
4. Sunday: run tatakae-phase-gate on the current phase.
