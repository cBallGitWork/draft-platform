#!/bin/bash
# PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.
# Adapted from epl-draft's guard_bash.sh (16 Oct 2026).
set -euo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | /usr/bin/jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

deny() {
  /usr/bin/jq -n --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# 1) Staging everything, in any spelling. CLAUDE.md: stage named paths.
if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|-u|--update|\.|:/)([[:space:]]|$)'; then
  deny "That stages everything. Stage named paths only: git add path/one path/two."
fi
if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+commit[[:space:]]+([^;&|]*[[:space:]])?(-a|-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)'; then
  deny "git commit -a stages every tracked change. Stage named paths with git add, then commit."
fi

# 2) Force push, in any spelling.
if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+push[^;&|]*[[:space:]](--force[^[:space:]]*|-f|\+[^[:space:]]+)([[:space:]]|$)'; then
  deny "No force pushes. If a branch has diverged, say so and let Craig decide."
fi

# 3) Committing on main, or pushing to it. CLAUDE.md: one branch and one PR per task.
if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+push[^;&|]*[[:space:]]([^[:space:]]*:)?main([[:space:]]|$)'; then
  deny "That pushes to main. Changes reach main only through a squash-merged PR."
fi
if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+(commit|push)([[:space:]]|$)'; then
  branch=$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" branch --show-current 2>/dev/null || echo "")
  if [ "$branch" = "main" ]; then
    deny "You are on main. Cut a branch first: git switch -c <type>/<thing> origin/main. Prefixes: feat/ fix/ refactor/ docs/ chore/."
  fi
fi

exit 0
