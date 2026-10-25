#!/bin/bash
# drift_due.py's checks: it says a drift pass is due at 10 or more commits on main since the last
# one (origin/main first, else main), and is otherwise silent; a git call that fails is one line on
# stderr.
. "$(dirname "$0")/helpers.sh"

commits() { # dir n [message]: n empty commits on the checked-out branch
  local i
  for ((i = 0; i < $2; i++)); do git -C "$1" "${as_tester[@]}" commit -q --allow-empty -m "${3:-fix: x}"; done
}

repo=$tmp/drift && git init -q -b main "$repo"
export CLAUDE_PROJECT_DIR=$repo
commits "$repo" 3
silent drift_due.py '{}'  # no pass yet, under 10
commits "$repo" 7
says "drift pass due: 10 merged since the start" drift_due.py '{}'
commits "$repo" 1 "refactor: drift pass 1: x (#1)"
pass=$(git -C "$repo" rev-parse --short HEAD)
commits "$repo" 9
silent drift_due.py '{}'  # 9 since the pass
commits "$repo" 1
says "drift pass due: 10 merged since $pass" drift_due.py '{}'
# the title is matched at a line's start, as REFACTORING.md's --grep does, so a mention mid-line isn't a pass
commits "$repo" 1 "docs: before the next refactor: drift pass"
says "drift pass due: 11 merged since $pass" drift_due.py '{}'

# origin/main is counted when it exists, even behind main (here at the pass, so nothing since)
git -C "$repo" update-ref refs/remotes/origin/main "$pass"
silent drift_due.py '{}'
# and ahead of main
git -C "$repo" checkout -q -b ahead && commits "$repo" 12 && git -C "$repo" checkout -q main
git -C "$repo" update-ref refs/remotes/origin/main ahead
says "drift pass due: 23 merged since $pass" drift_due.py '{}'

# a checkout with neither, or no git at all, says so in one line on stderr, never silence
nomain=$tmp/drift-nomain && git init -q -b trunk "$nomain" && commits "$nomain" 1
fails_loudly "drift_due.py: neither origin/main nor main exists in $nomain" drift_due.py '{}' CLAUDE_PROJECT_DIR="$nomain"
nogit=$(mktemp -d) || exit 1
fails_loudly "so it can't say whether a drift pass is due." drift_due.py '{}' CLAUDE_PROJECT_DIR="$nogit"
rm -rf "$nogit"
