#!/usr/bin/env bash
# Installs the Claude Code plugins/skills this project uses (user scope). Safe to re-run.
set -uo pipefail
command -v claude >/dev/null || { echo "Install Claude Code first."; exit 1; }

run() { echo "+ $*"; "$@" || echo "  (skipped/failed: $*)"; }

# Anthropic skills
run claude plugin marketplace add anthropics/skills
run claude plugin install example-skills@anthropic-agent-skills
# run claude plugin install document-skills@anthropic-agent-skills   # optional

# UI/UX Pro Max (needs python3 for its search script)
run claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
run claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill

# Official marketplace: Superpowers + Expo
run claude plugin install superpowers@claude-plugins-official
run claude plugin install expo@claude-plugins-official

# HashiCorp Terraform
run claude plugin marketplace add hashicorp/agent-skills
run claude plugin install terraform@hashicorp

# Vercel React / React Native skills (skills CLI; it asks which agent — choose Claude Code)
for s in react-best-practices react-native-skills web-design-guidelines composition-patterns; do
  run npx -y skills@latest add vercel-labs/agent-skills --skill "$s"
done

echo
echo "Done. Restart Claude Code, then run /plugin to confirm. Project skills in .claude/skills load automatically."
